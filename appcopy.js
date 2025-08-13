// --- Imports (ESM via esm.sh) ---
import { Connection, clusterApiUrl } from "https://esm.sh/@solana/web3.js";
import { PhantomWalletAdapter } from "https://esm.sh/@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "https://esm.sh/@solana/wallet-adapter-solflare";
import { GlowWalletAdapter } from "https://esm.sh/@solana/wallet-adapter-glow";
import { WalletReadyState } from "https://esm.sh/@solana/wallet-adapter-base";

// --- Solana connection (mainnet) ---
const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

// --- Wallet adapters ---
const adapters = {
  Phantom: new PhantomWalletAdapter(),
  Solflare: new SolflareWalletAdapter(),
  Glow: new GlowWalletAdapter(),
};

// --- Mobile helpers ---
const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
);
// Use the current page URL (without hash) so the wallet app opens this site in its in-app browser
const DAPP_URL = encodeURIComponent(window.location.href.split("#")[0]);
const DEEPLINKS = {
  Phantom: `https://phantom.app/ul/browse/${DAPP_URL}`,
  Solflare: `https://solflare.com/ul/v1/browse/${DAPP_URL}`,
  // Glow doesn't document a browse deeplink publicly; send users to app where they can open your URL
  Glow: `https://glow.app/`,
};
function openWalletDeepLink(name) {
  const link = DEEPLINKS[name];
  if (!link) return;
  // Using location.href improves handoff to wallet apps on iOS/Android
  window.location.href = link;
}

// --- State ---
let currentWallet = null; // adapter
let currentAddress = null; // PublicKey
let isBotActive = false;

// --- Elements ---
const walletBtn = document.getElementById("wallet-btn");
const walletText = document.getElementById("wallet-text");
const walletMenu = document.getElementById("wallet-menu");
const menuAddress = document.getElementById("menu-address");
const copyAddressBtn = document.getElementById("copy-address");
const viewExplorerBtn = document.getElementById("view-explorer");
const disconnectBtn = document.getElementById("disconnect-wallet");

const walletModal = document.getElementById("walletModal");
const closeModal = document.getElementById("closeModal");
const walletOptions = document.querySelectorAll(".wallet-option");
const otherWalletLink = document.getElementById("otherWalletLink");

// Dashboard bits
const solBalanceEl = document.getElementById("sol-balance");
const usdBalanceEl = document.getElementById("usd-balance");
const toggleBotBtn = document.getElementById("toggle-bot");
const statusIndicator = document.getElementById("status-indicator");
const statusTitle = document.getElementById("status-title");
const statusSubtitle = document.getElementById("status-subtitle");
const activityList = document.getElementById("activity-list");
const activityPlaceholder = document.getElementById("activity-placeholder");

// Settings model
const botSettings = {
  "max-trade": { value: 0.5, unit: "SOL", min: 0.1, max: 10 },
  "stop-loss": { value: 15, unit: "%", min: 5, max: 50 },
  "take-profit": { value: 25, unit: "%", min: 10, max: 100 },
  "slippage": { value: 3, unit: "%", min: 0.1, max: 10 },
};

// --- Helpers ---
const shorten = (addr) => addr.slice(0, 4) + "..." + addr.slice(-4);
const lamportsToSol = (lamports) => lamports / 1e9;
const $ = (sel) => document.querySelector(sel);

function showNotification(message, type = "primary") {
  const n = document.createElement("div");
  n.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: ${
      type === "success"
        ? "var(--success)"
        : type === "warning"
        ? "var(--warning)"
        : type === "danger"
        ? "var(--danger)"
        : "var(--primary)"
    };
    color: white; padding: 1rem 1.5rem; border-radius: .6rem; font-weight: 600; z-index: 2000; box-shadow: 0 10px 30px rgba(0,0,0,.3);
  `;
  n.textContent = message;
  document.body.appendChild(n);
  setTimeout(() => {
    n.style.opacity = "0";
    n.style.transform = "translateX(20px)";
    setTimeout(() => n.remove(), 300);
  }, 2500);
}

function openModal() {
  walletModal.style.display = "flex";
}
function closeModalFn() {
  walletModal.style.display = "none";
}
function toggleMenu(show) {
  walletMenu.style.display = show ? "block" : "none";
}

// Detect mobile device
function isMobileDevice() {
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

document.addEventListener("DOMContentLoaded", function () {
    const connectBtn = document.getElementById("connectWalletBtn");

    if (!connectBtn) return;

    connectBtn.addEventListener("click", async function () {
        try {
            // Solana wallet adapter setup
            const { WalletAdapterNetwork } = solanaWalletAdapter;
            const network = WalletAdapterNetwork.Mainnet;

            const wallet = new solanaWalletAdapter.PhantomWalletAdapter();

            if (isMobileDevice()) {
                // Mobile logic: Open wallet app and connect
                const deepLink = "https://phantom.app/ul/browse/" + encodeURIComponent(window.location.href);

                // Open Phantom app
                window.open(deepLink, "_blank");

                // Try to connect after a short delay
                setTimeout(async () => {
                    try {
                        await wallet.connect();
                        console.log("Wallet connected on mobile:", wallet.publicKey.toString());
                    } catch (err) {
                        console.error("Mobile wallet connection failed:", err);
                    }
                }, 1500);

            } else {
                // Desktop logic: Just open the connect modal
                await wallet.connect();
                console.log("Wallet connected on desktop:", wallet.publicKey.toString());
            }

        } catch (err) {
            console.error("Wallet connection error:", err);
        }
    });
});

// Detect installed vs. install-needed and mark pills
function refreshInstallPills() {
  const states = {
    Phantom: adapters.Phantom.readyState,
    Solflare: adapters.Solflare.readyState,
    Glow: adapters.Glow.readyState,
  };
  ["Phantom", "Solflare", "Glow"].forEach((name) => {
    const pill = document.querySelector(`.pill[data-pill="${name}"]`);
    if (!pill) return;

    const installed = states[name] === WalletReadyState.Installed;
    if (installed) {
      pill.textContent = "Installed";
      pill.classList.remove("install");
      pill.classList.remove("open-app");
    } else if (IS_MOBILE) {
      // On mobile there are no extensions; guide users to open the wallet app
      pill.textContent = "Open App";
      pill.classList.add("open-app");
      pill.classList.remove("install");
    } else {
      pill.textContent = "Install";
      pill.classList.add("install");
      pill.classList.remove("open-app");
    }
  });
}

// Price fetch (best-effort; if it fails, keep $0)
async function fetchSolPriceUSD() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const data = await res.json();
    return Number(data?.solana?.usd ?? 0);
  } catch {
    return 0;
  }
}

async function updateBalances(pubkey) {
  try {
    const lamports = await connection.getBalance(pubkey);
    const sol = lamportsToSol(lamports);
    solBalanceEl.textContent = sol.toFixed(2);

    const usd = await fetchSolPriceUSD();
    const usdVal = usd ? sol * usd : 0;
    usdBalanceEl.textContent = `$${usdVal.toFixed(2)}`;
  } catch (e) {
    console.error(e);
  }
}

function setConnectedUI(addressStr) {
  walletBtn.classList.add("connected");
  walletText.textContent = shorten(addressStr);
  menuAddress.textContent = shorten(addressStr);

  toggleBotBtn.disabled = false;
  toggleBotBtn.style.opacity = "1";
  toggleBotBtn.style.cursor = "pointer";
  toggleBotBtn.textContent = isBotActive ? "Stop Bot" : "Start Bot";
  statusSubtitle.textContent = "Bot ready • Click start to begin trading";

  // Demo activity list
  if (activityPlaceholder) activityPlaceholder.style.display = "none";
  activityList.innerHTML = `
    <div class="activity-item">
      <div class="activity-icon buy"><i class="fas fa-arrow-up"></i></div>
      <div class="activity-details"><div class="activity-token">BONK</div><div class="activity-time">2 minutes ago</div></div>
      <div class="activity-amount profit">+$127.50</div>
    </div>
    <div class="activity-item">
      <div class="activity-icon sell"><i class="fas fa-arrow-down"></i></div>
      <div class="activity-details"><div class="activity-token">PEPE</div><div class="activity-time">5 minutes ago</div></div>
      <div class="activity-amount profit">+$89.25</div>
    </div>
    <div class="activity-item">
      <div class="activity-icon buy"><i class="fas fa-arrow-up"></i></div>
      <div class="activity-details"><div class="activity-token">WIF</div><div class="activity-time">12 minutes ago</div></div>
      <div class="activity-amount profit">+$234.75</div>
    </div>
    <div class="activity-item">
      <div class="activity-icon sell"><i class="fas fa-arrow-down"></i></div>
      <div class="activity-details"><div class="activity-token">SAMO</div><div class="activity-time">18 minutes ago</div></div>
      <div class="activity-amount loss">-$45.20</div>
    </div>
  `;
}

function setDisconnectedUI() {
  walletBtn.classList.remove("connected");
  walletText.textContent = "Connect Wallet";
  toggleMenu(false);

  isBotActive = false;
  statusIndicator.classList.add("inactive");
  statusTitle.textContent = "Trading Bot Inactive";
  statusSubtitle.textContent = "Connect wallet to start trading";
  toggleBotBtn.textContent = "Connect Wallet First";
  toggleBotBtn.disabled = true;
  toggleBotBtn.style.opacity = ".5";
  toggleBotBtn.style.cursor = "not-allowed";
  toggleBotBtn.classList.remove("stop");

  solBalanceEl.textContent = "0.00";
  usdBalanceEl.textContent = "$0.00";

  activityList.innerHTML = `
    <div class="activity-placeholder" id="activity-placeholder" style="text-align:center; padding:3rem 2rem; color:var(--text-secondary);">
      <i class="fas fa-wallet" style="font-size:3rem; margin-bottom:1rem; opacity:.3;"></i>
      <div style="font-size:1.1rem; margin-bottom:.5rem;">No Trading Activity</div>
      <div style="font-size:.9rem;">Connect your wallet to view trading history</div>
    </div>
  `;
}

// --- Wallet flow ---
async function connectSelectedWallet(adapterName) {
  const adapter = adapters[adapterName];
  if (!adapter) return;
  currentWallet = adapter;

  const isInstalled = adapter.readyState === WalletReadyState.Installed;

  // MOBILE: deep link into the wallet app if no extension is "installed"
  if (!isInstalled && IS_MOBILE) {
    showNotification(`Opening ${adapterName}…`, "primary");
    openWalletDeepLink(adapterName);
    return;
  }

  // DESKTOP (or mobile with in-app browser provider injected)
  if (!isInstalled && !IS_MOBILE) {
    const installLinks = {
      Phantom: "https://phantom.app/download",
      Solflare: "https://solflare.com/download",
      Glow: "https://glow.app",
    };
    window.open(
      installLinks[adapterName] ||
        "https://solana.com/ecosystem/wallets?filter=popular",
      "_blank"
    );
    return;
  }

  try {
    await adapter.connect();
    currentAddress = adapter.publicKey;
    closeModalFn();
    const addressStr = currentAddress.toString();

    setConnectedUI(addressStr);
    await updateBalances(currentAddress);
    showNotification(`Connected: ${shorten(addressStr)}`, "success");

    // Listen for disconnect from wallet UI
    adapter.on("disconnect", () => {
      currentWallet = null;
      currentAddress = null;
      setDisconnectedUI();
      showNotification("Wallet disconnected.", "primary");
    });
  } catch (err) {
    console.error("Connection failed", err);
    showNotification(err?.message || "Wallet connection failed", "danger");
  }
}

async function disconnectWallet() {
  try {
    if (currentWallet) await currentWallet.disconnect();
  } catch (e) {
    // Some wallets throw if already disconnected
  } finally {
    currentWallet = null;
    currentAddress = null;
    setDisconnectedUI();
  }
}

// --- Event wiring ---

// Open modal if not connected; else toggle dropdown menu
walletBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!currentWallet || !currentWallet.connected) {
    refreshInstallPills();
    openModal();
  } else {
    toggleMenu(walletMenu.style.display !== "block");
  }
});

// Wallet options (modal)
walletOptions.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const name = btn.getAttribute("data-wallet");
    await connectSelectedWallet(name);
  });
});

// Modal close + click outside
closeModal.addEventListener("click", closeModalFn);
walletModal.addEventListener("click", (e) => {
  if (e.target === walletModal) closeModalFn();
});

// “Your wallet isn’t here?” link
otherWalletLink.addEventListener("click", (e) => {
  e.preventDefault();
  window.open(
    "https://solana.com/ecosystem/wallets?filter=popular",
    "_blank"
  );
});

// Connected dropdown actions
document.addEventListener("click", () => toggleMenu(false)); // click-away to close
walletMenu.addEventListener("click", (e) => e.stopPropagation()); // keep menu open when clicking inside

copyAddressBtn.addEventListener("click", async () => {
  if (!currentAddress) return;
  try {
    await navigator.clipboard.writeText(currentAddress.toString());
    showNotification("Address copied!", "success");
  } catch {
    showNotification("Copy failed. Long-press to copy.", "warning");
  }
  toggleMenu(false);
});

viewExplorerBtn.addEventListener("click", () => {
  if (!currentAddress) return;
  const url = `https://explorer.solana.com/address/${currentAddress.toString()}?cluster=mainnet`;
  window.open(url, "_blank");
  toggleMenu(false);
});

disconnectBtn.addEventListener("click", async () => {
  await disconnectWallet();
  toggleMenu(false);
});

// Bot toggle
toggleBotBtn.addEventListener("click", () => {
  if (!currentWallet || !currentWallet.connected) {
    showNotification("Please connect your wallet first", "warning");
    return;
  }
  isBotActive = !isBotActive;
  if (isBotActive) {
    statusIndicator.classList.remove("inactive");
    statusTitle.textContent = "Trading Bot Active";
    statusSubtitle.textContent =
      "Scanning for opportunities • Last trade: 2 min ago";
    toggleBotBtn.textContent = "Stop Bot";
    toggleBotBtn.classList.add("stop");
    showNotification("Trading bot started", "success");
  } else {
    statusIndicator.classList.add("inactive");
    statusTitle.textContent = "Trading Bot Inactive";
    statusSubtitle.textContent =
      "Bot stopped • Click start to resume trading";
    toggleBotBtn.textContent = "Start Bot";
    toggleBotBtn.classList.remove("stop");
    showNotification("Trading bot stopped", "warning");
  }
});

// Settings: open/edit modal via delegation
document.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".edit-btn");
  if (!editBtn) return;

  const key = editBtn.getAttribute("data-setting");
  const unit = editBtn.getAttribute("data-unit");
  const setting = botSettings[key];
  if (!setting) return;

  // Build modal
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.display = "flex";
  overlay.innerHTML = `
    <div class="modal-card" style="animation:slideUp .3s ease-out;">
      <div class="modal-header">
        <h3>Edit ${key
          .replace("-", " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())}</h3>
        <button class="close-btn" data-close>Edit</button>
      </div>
      <div class="modal-body">
        <label style="display:block; margin-bottom:.5rem; color:var(--text-secondary);">
          Value (${setting.min} - ${setting.max} ${unit})
        </label>
        <input type="number" id="setting-input" value="${setting.value}" min="${setting.min}" max="${setting.max}" step="0.1"
          style="width:100%; background:rgba(51,65,85,.3); border:2px solid var(--border); border-radius:.6rem; padding:.8rem; color:var(--text); font-size:1rem;">
      </div>
      <div class="modal-footer">
        <button class="close-btn" data-close>Cancel</button>
        <button id="save-setting" class="close-btn" style="background:linear-gradient(135deg,var(--primary),var(--secondary)); border:none; color:#fff;">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (evt) => {
    if (evt.target === overlay || evt.target.hasAttribute("data-close"))
      overlay.remove();
  });
  $("#save-setting").addEventListener("click", () => {
    const input = $("#setting-input");
    const newVal = parseFloat(input.value);
    if (isNaN(newVal) || newVal < setting.min || newVal > setting.max) {
      showNotification(
        `Value must be between ${setting.min} and ${setting.max}`,
        "warning"
      );
      return;
    }
    setting.value = newVal;
    const prefix =
      key === "stop-loss" ? "-" : key === "take-profit" ? "+" : "";
    const display = document.getElementById(`${key}-display`);
    display.textContent = `${prefix}${newVal}${unit}`;
    overlay.remove();
    showNotification(
      `${key.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())} updated`,
      "success"
    );
  });
});

// Simulate “minutes ago” drift while bot runs
setInterval(() => {
  if (!currentWallet || !currentWallet.connected || !isBotActive) return;
  const items = document.querySelectorAll(".activity-time");
  if (items.length) {
    const idx = Math.floor(Math.random() * items.length);
    const t = items[idx].textContent;
    const m = parseInt(t);
    if (!isNaN(m)) items[idx].textContent = `${m + 1} minutes ago`;
  }
}, 60_000);

// If the page regains focus after returning from a wallet app, refresh balances/UI
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && currentWallet?.connected) {
    try {
      currentAddress = currentWallet.publicKey;
      if (currentAddress) {
        setConnectedUI(currentAddress.toString());
        await updateBalances(currentAddress);
      }
    } catch {}
  }
});

// Initial setup
document.addEventListener("DOMContentLoaded", () => {
  statusIndicator.classList.add("inactive");
  statusTitle.textContent = "Trading Bot Inactive";
  statusSubtitle.textContent = "Connect wallet to start trading";
  toggleBotBtn.textContent = "Connect Wallet First";
  toggleBotBtn.disabled = true;
  toggleBotBtn.style.opacity = ".5";
  toggleBotBtn.style.cursor = "not-allowed";
  // Mark install/open status in the modal (best-effort)
  refreshInstallPills();
});
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Solanex Pro</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }

        :root{
            --primary:#9945FF; --secondary:#14F195; --dark:#0f172a; --darker:#0a1120; --card:#1e293b;
            --border:#334155; --text:#e2e8f0; --text-secondary:#94a3b8; --success:#10b981;
            --danger:#ef4444; --warning:#f59e0b;
        }

        body{ background:linear-gradient(135deg,var(--darker) 0%,var(--dark) 100%); color:var(--text); min-height:100vh; line-height:1.6; }

        /* Header */
        .header{ background:rgba(30,41,59,.95); backdrop-filter:blur(10px); border-bottom:1px solid var(--border); padding:1rem 0; position:sticky; top:0; z-index:100; box-shadow:0 5px 20px rgba(0,0,0,.3); }
        .nav{ display:flex; justify-content:space-between; align-items:center; max-width:1400px; margin:0 auto; padding:0 2rem; }
        .logo{ display:flex; align-items:center; gap:.8rem; }
        .logo-icon{ background:linear-gradient(135deg,var(--primary),var(--secondary)); padding:.5rem; border-radius:.8rem; color:#fff; width:40px; height:40px; display:flex; align-items:center; justify-content:center; }
        .logo-text{ font-size:1.5rem; font-weight:800; background:linear-gradient(135deg,var(--primary),var(--secondary)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }

        .nav-actions{ display:flex; align-items:center; gap:1rem; position:relative; }
        .wallet-btn{ background:linear-gradient(135deg,var(--primary),var(--secondary)); color:#fff; border:none; padding:.8rem 1.5rem; border-radius:.6rem; font-weight:600; cursor:pointer; transition:all .3s; display:flex; align-items:center; gap:.5rem; }
        .wallet-btn:hover{ transform:translateY(-2px); box-shadow:0 8px 25px rgba(153,69,255,.4); }
        .wallet-btn.connected{ background:rgba(16,185,129,.2); border:1px solid var(--success); color:var(--success); }

        /* Connected dropdown */
        .wallet-menu{ position:absolute; top:58px; right:0; background:rgba(30,41,59,.98); border:1px solid var(--border); border-radius:.75rem; min-width:220px; box-shadow:0 10px 30px rgba(0,0,0,.35); display:none; overflow:hidden; }
        .wallet-menu header{ padding:.9rem 1rem; border-bottom:1px solid var(--border); font-size:.9rem; color:var(--text-secondary); }
        .wallet-menu .menu-item{ display:flex; align-items:center; gap:.65rem; padding:.8rem 1rem; cursor:pointer; transition:.2s; color:var(--text); }
        .wallet-menu .menu-item:hover{ background:rgba(148,163,184,.1); }
        .wallet-menu .addr{ font-weight:700; color:var(--text); }

        /* Main Content */
        .main-content{ max-width:1400px; margin:0 auto; padding:2rem; display:grid; grid-template-columns:1fr 300px; gap:2rem; }
        .dashboard-grid{ display:grid; gap:2rem; }

        /* Cards */
        .card{ background:rgba(30,41,59,.8); backdrop-filter:blur(10px); border:1px solid var(--border); border-radius:1rem; padding:1.5rem; box-shadow:0 10px 30px rgba(0,0,0,.15); transition:all .3s; }
        .card:hover{ transform:translateY(-2px); box-shadow:0 15px 35px rgba(0,0,0,.2); }
        .card-header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; }
        .card-title{ font-size:1.2rem; font-weight:700; color:var(--text); }
        .card-icon{ color:var(--secondary); font-size:1.2rem; }

        /* Balance Cards */
        .balance-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:1.5rem; margin-bottom:2rem; }
        .balance-card{ background:rgba(30,41,59,.8); border:1px solid var(--border); border-radius:1rem; padding:1.5rem; text-align:center; position:relative; overflow:hidden; }
        .balance-card::before{ content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,var(--primary),var(--secondary)); }
        .balance-amount{ font-size:2rem; font-weight:800; margin-bottom:.5rem; background:linear-gradient(135deg,var(--primary),var(--secondary)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .balance-label{ color:var(--text-secondary); font-size:.9rem; margin-bottom:.5rem; }
        .balance-change{ font-size:.8rem; font-weight:600; display:flex; align-items:center; justify-content:center; gap:.3rem; }
        .balance-change.positive{ color:var(--success); } .balance-change.negative{ color:var(--danger); }

        /* Bot Status */
        .bot-status{ display:flex; align-items:center; gap:1rem; padding:1rem; background:rgba(51,65,85,.3); border-radius:.8rem; margin-bottom:2rem; }
        .status-indicator{ width:12px; height:12px; border-radius:50%; background:var(--success); animation:pulse 2s infinite; }
        .status-indicator.inactive{ background:var(--danger); animation:none; }
        @keyframes pulse{ 0%{ box-shadow:0 0 0 0 rgba(16,185,129,.7); } 70%{ box-shadow:0 0 0 10px rgba(16,185,129,0); } 100%{ box-shadow:0 0 0 0 rgba(16,185,129,0); } }
        .toggle-btn{ background:var(--success); color:#fff; border:none; padding:.5rem 1rem; border-radius:.5rem; font-weight:600; cursor:pointer; transition:all .3s; }
        .toggle-btn:hover{ transform:scale(1.05); } .toggle-btn.stop{ background:var(--danger); }

        /* Activity */
        .activity-item{ display:flex; align-items:center; gap:1rem; padding:1rem; background:rgba(51,65,85,.3); border-radius:.8rem; margin-bottom:1rem; transition:all .3s; }
        .activity-item:hover{ background:rgba(51,65,85,.5); }
        .activity-icon{ width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.1rem; }
        .activity-icon.buy{ background:rgba(16,185,129,.2); color:var(--success); }
        .activity-icon.sell{ background:rgba(239,68,68,.2); color:var(--danger); }
        .activity-details{ flex:1; }
        .activity-token{ font-weight:600; color:var(--text); }
        .activity-time{ font-size:.8rem; color:var(--text-secondary); }
        .activity-amount{ font-weight:600; text-align:right; }
        .activity-amount.profit{ color:var(--success); } .activity-amount.loss{ color:var(--danger); }

        /* Chart */
        .chart-container{ height:300px; background:rgba(51,65,85,.3); border-radius:.8rem; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); font-size:1.1rem; position:relative; overflow:hidden; }
        .chart-placeholder{text-align:center;}

        /* Sidebar */
        .sidebar{ display:grid; gap:2rem; }

        /* Market/Settings */
        .settings-item{ display:flex; justify-content:space-between; align-items:center; padding:1rem 0; border-bottom:1px solid rgba(51,65,85,.3); }
        .settings-item:last-child{ border-bottom:none; }
        .setting-label{ color:var(--text); font-weight:500; }
        .setting-value{ color:var(--text-secondary); font-size:.9rem; }
        .edit-btn{ background:none; border:1px solid var(--border); color:var(--text-secondary); padding:.3rem .8rem; border-radius:.4rem; font-size:.8rem; cursor:pointer; transition:all .3s; }
        .edit-btn:hover{ border-color:var(--secondary); color:var(--secondary); }

        /* Quick Actions */
        .qa-grid{ display:grid; gap:1rem; }
        .qa-btn{ border:none; padding:.8rem; border-radius:.6rem; font-weight:600; cursor:pointer; transition:transform .2s; color:#fff; }
        .qa-btn:hover{ transform:scale(1.02); }
        .qa-start{ background:var(--success); } .qa-export{ background:var(--warning); } .qa-analytics{ background:var(--primary); }

        /* Modal (wallet connect) */
        .modal-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.6); display:none; justify-content:center; align-items:center; z-index:1000; }
        .modal-card{
            background:rgba(30,41,59,.98); border:1px solid var(--border); border-radius:1rem;
            width:min(480px,92%); box-shadow:0 20px 60px rgba(0,0,0,.45); overflow:hidden;
        }
        .modal-header{ display:flex; align-items:center; justify-content:space-between; padding:1rem 1.25rem; border-bottom:1px solid var(--border); }
        .modal-header h3{ font-size:1.1rem; }
        .modal-body{ padding:1rem 1.25rem 1.25rem; }
        .wallet-grid{ display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
        .wallet-option{
            display:flex; align-items:center; gap:.75rem; background:rgba(51,65,85,.35); border:1px solid var(--border);
            border-radius:.7rem; padding:.8rem; cursor:pointer; transition:all .2s; position:relative;
        }
        .wallet-option:hover{ transform:translateY(-1px); background:rgba(51,65,85,.5); }
        .wallet-icon{
            width:36px; height:36px; border-radius:.6rem; display:grid; place-items:center; font-size:1.1rem; color:#fff;
            background:linear-gradient(135deg,var(--primary),var(--secondary));
        }
        .wallet-name{ font-weight:700; }
        .pill{ position:absolute; right:.6rem; top:.6rem; font-size:.7rem; padding:.15rem .45rem; border-radius:.4rem; border:1px solid var(--border); color:var(--text-secondary); }
        .pill.install{ color:#fff; border:none; background:linear-gradient(135deg,#f43f5e,#f59e0b); }
        .modal-footer{ display:flex; justify-content:space-between; align-items:center; gap:.75rem; padding:1rem 1.25rem; border-top:1px solid var(--border); }
        .link{ color:var(--secondary); text-decoration:none; font-size:.9rem; }
        .close-btn{ background:none; border:1px solid var(--border); color:var(--text-secondary); padding:.5rem .9rem; border-radius:.5rem; cursor:pointer; }
        .hidden{ display:none !important; }

        /* Responsive */
        @media (max-width:1200px){ .main-content{ grid-template-columns:1fr; padding:1rem; } .sidebar{ grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); } }
        @media (max-width:768px){ .nav{ padding:0 1rem; } .balance-grid{ grid-template-columns:1fr; } .nav-actions{ gap:.5rem; } .wallet-btn{ padding:.6rem 1rem; font-size:.9rem; } }

        /* Animations */
        .fade-in{ animation:fadeIn .6s ease-out; }
        @keyframes fadeIn{ from{ opacity:0; transform:translateY(20px);} to{ opacity:1; transform:translateY(0);} }
        .loading{ display:inline-block; width:20px; height:20px; border:3px solid rgba(255,255,255,.3); border-radius:50%; border-top-color:var(--secondary); animation:spin 1s ease-in-out infinite; }
        @keyframes spin{ to{ transform:rotate(360deg);} }
        @keyframes slideUp{ from{ transform:translateY(30px); opacity:0;} to{ transform:translateY(0); opacity:1;} }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <nav class="nav">
            <div class="logo">
                <div class="logo-icon"><i class="fas fa-robot"></i></div>
                <span class="logo-text">Solanex Pro</span>
            </div>

            <div class="nav-actions">
                <button class="wallet-btn" id="wallet-btn">
                    <i class="fas fa-wallet"></i><span id="wallet-text">Connect Wallet</span>
                </button>

                <!-- Connected state dropdown -->
                <div id="wallet-menu" class="wallet-menu">
                    <header>Connected as <span class="addr" id="menu-address">—</span></header>
                    <div class="menu-item" id="copy-address"><i class="fa-regular fa-copy"></i> Copy address</div>
                    <div class="menu-item" id="view-explorer"><i class="fa-solid fa-arrow-up-right-from-square"></i> View on Explorer</div>
                    <div class="menu-item" id="disconnect-wallet"><i class="fa-solid fa-right-from-bracket"></i> Disconnect</div>
                </div>

                <div class="user-menu">
                    <div class="user-avatar"><i class="fas fa-user"></i></div>
                </div>
            </div>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="main-content">
        <div class="dashboard-grid">
            <!-- Balance Cards -->
            <div class="balance-grid">
                <div class="balance-card fade-in">
                    <div class="balance-amount" id="sol-balance">0.00</div>
                    <div class="balance-label">SOL Balance</div>
                    <div class="balance-change positive"><i class="fas fa-arrow-up"></i><span>+0.0%</span></div>
                </div>
                <div class="balance-card fade-in">
                    <div class="balance-amount" id="usd-balance">$0.00</div>
                    <div class="balance-label">USD Value</div>
                    <div class="balance-change positive"><i class="fas fa-arrow-up"></i><span>+$0.00</span></div>
                </div>
                <div class="balance-card fade-in">
                    <div class="balance-amount" id="pnl-amount">+$0</div>
                    <div class="balance-label">Total P&L</div>
                    <div class="balance-change positive"><i class="fas fa-arrow-up"></i><span>+0.0%</span></div>
                </div>
                <div class="balance-card fade-in">
                    <div class="balance-amount" id="active-trades">0</div>
                    <div class="balance-label">Active Trades</div>
                    <div class="balance-change positive"><i class="fas fa-arrow-up"></i><span>0 today</span></div>
                </div>
            </div>

            <!-- Bot Status -->
            <div class="card fade-in">
                <div class="bot-status">
                    <div class="status-indicator" id="status-indicator"></div>
                    <div class="status-text">
                        <div class="status-title" id="status-title">Trading Bot Inactive</div>
                        <div class="status-subtitle" id="status-subtitle">Connect wallet to start trading</div>
                    </div>
                    <button class="toggle-btn" id="toggle-bot" disabled style="opacity:.5; cursor:not-allowed;">Connect Wallet First</button>
                </div>
            </div>

            <!-- Performance Chart -->
            <div class="card fade-in">
                <div class="card-header">
                    <h3 class="card-title">Performance Chart</h3>
                    <i class="fas fa-chart-line card-icon"></i>
                </div>
                <div class="chart-container">
                    <div class="chart-placeholder">
                        <i class="fas fa-chart-area" style="font-size:3rem; margin-bottom:1rem; opacity:.3;"></i>
                        <div>Performance chart will be displayed here</div>
                        <div style="font-size:.9rem; margin-top:.5rem;">Connect your wallet to view real-time data</div>
                    </div>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="card fade-in">
                <div class="card-header">
                    <h3 class="card-title">Recent Trading Activity</h3>
                    <i class="fas fa-history card-icon"></i>
                </div>
                <div class="activity-list" id="activity-list">
                    <div class="activity-placeholder" id="activity-placeholder" style="text-align:center; padding:3rem 2rem; color:var(--text-secondary);">
                        <i class="fas fa-wallet" style="font-size:3rem; margin-bottom:1rem; opacity:.3;"></i>
                        <div style="font-size:1.1rem; margin-bottom:.5rem;">No Trading Activity</div>
                        <div style="font-size:.9rem;">Connect your wallet to view trading history</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sidebar -->
        <div class="sidebar">
            <!-- Bot Settings -->
            <div class="card fade-in">
                <div class="card-header"><h3 class="card-title">Bot Settings</h3><i class="fas fa-cog card-icon"></i></div>
                <div class="settings-list">
                    <div class="settings-item">
                        <div class="setting-label">Max Trade Size</div>
                        <div class="setting-value"><span id="max-trade-display">0.5 SOL</span><button class="edit-btn" data-setting="max-trade" data-unit="SOL" data-value="0.5">Edit</button></div>
                    </div>
                    <div class="settings-item">
                        <div class="setting-label">Stop Loss</div>
                        <div class="setting-value"><span id="stop-loss-display">-15%</span><button class="edit-btn" data-setting="stop-loss" data-unit="%" data-value="15">Edit</button></div>
                    </div>
                    <div class="settings-item">
                        <div class="setting-label">Take Profit</div>
                        <div class="setting-value"><span id="take-profit-display">+25%</span><button class="edit-btn" data-setting="take-profit" data-unit="%" data-value="25">Edit</button></div>
                    </div>
                    <div class="settings-item">
                        <div class="setting-label">Slippage</div>
                        <div class="setting-value"><span id="slippage-display">3%</span><button class="edit-btn" data-setting="slippage" data-unit="%" data-value="3">Edit</button></div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="card fade-in">
                <div class="card-header"><h3 class="card-title">Quick Actions</h3><i class="fas fa-bolt card-icon"></i></div>
                <div class="qa-grid">
                    <button class="qa-btn qa-start"><i class="fas fa-play"></i> Start New Strategy</button>
                    <button class="qa-btn qa-export"><i class="fas fa-download"></i> Export Trades</button>
                    <button class="qa-btn qa-analytics"><i class="fas fa-chart-bar"></i> View Analytics</button>
                </div>
            </div>
        </div>
    </main>

    <!-- Wallet Selection Modal -->
    <div id="walletModal" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-header">
                <h3>Connect a wallet</h3>
                <button id="closeModal" class="close-btn">Close</button>
            </div>
            <div class="modal-body">
                <div class="wallet-grid">
                    <button class="wallet-option" data-wallet="Phantom">
                        <div class="wallet-icon"><i class="fa-solid fa-ghost"></i></div>
                        <div>
                            <div class="wallet-name">Phantom</div>
                            <div class="wallet-sub" style="font-size:.85rem; color:var(--text-secondary);">Browser & mobile</div>
                        </div>
                        <span class="pill" data-pill="Phantom"></span>
                    </button>

                    <button class="wallet-option" data-wallet="Solflare">
                        <div class="wallet-icon"><i class="fa-solid fa-sun"></i></div>
                        <div>
                            <div class="wallet-name">Solflare</div>
                            <div class="wallet-sub" style="font-size:.85rem; color:var(--text-secondary);">Extension & mobile</div>
                        </div>
                        <span class="pill" data-pill="Solflare"></span>
                    </button>

                    <button class="wallet-option" data-wallet="Glow">
                        <div class="wallet-icon"><i class="fa-solid fa-bolt"></i></div>
                        <div>
                            <div class="wallet-name">Glow</div>
                            <div class="wallet-sub" style="font-size:.85rem; color:var(--text-secondary);">Extension</div>
                        </div>
                        <span class="pill" data-pill="Glow"></span>
                    </button>

                    <!-- Add more here later if you want -->
                </div>
            </div>
            <div class="modal-footer">
                <a href="#" id="otherWalletLink" class="link">Your wallet isn’t here?</a>
                <span style="font-size:.85rem; color:var(--text-secondary);">Direct Solana connection</span>
            </div>
        </div>
    </div>

    <!-- App JS -->
    <script type="module" src="appcopy.js"></script>
</body>
</html>
