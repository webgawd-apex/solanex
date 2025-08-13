// --- Imports (ESM via esm.sh) ---
import { Connection, clusterApiUrl, PublicKey } from "https://esm.sh/@solana/web3.js";
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

// --- State ---// --- Imports (ESM via esm.sh) ---
import { Connection, clusterApiUrl, PublicKey } from "https://esm.sh/@solana/web3.js";
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
const lamportsToSol = (lamports) => (lamports / 1e9);
const $ = (sel) => document.querySelector(sel);

function showNotification(message, type = "primary") {
  const n = document.createElement("div");
  n.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: ${type === "success" ? "var(--success)" : type === "warning" ? "var(--warning)" : type === "danger" ? "var(--danger)" : "var(--primary)"};
    color: white; padding: 1rem 1.5rem; border-radius: .6rem; font-weight: 600; z-index: 2000; box-shadow: 0 10px 30px rgba(0,0,0,.3);
  `;
  n.textContent = message;
  document.body.appendChild(n);
  setTimeout(() => { n.style.opacity = "0"; n.style.transform = "translateX(20px)"; setTimeout(() => n.remove(), 300); }, 2500);
}

function openModal() { walletModal.style.display = "flex"; }
function closeModalFn() { walletModal.style.display = "none"; }
function toggleMenu(show) { walletMenu.style.display = show ? "block" : "none"; }

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
    if (states[name] === WalletReadyState.Installed) {
      pill.textContent = "Installed";
      pill.classList.remove("install");
    } else {
      pill.textContent = "Install";
      pill.classList.add("install");
    }
  });
}

// Price fetch (best-effort; if it fails, keep $0)
async function fetchSolPriceUSD() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
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
    const usdVal = usd ? (sol * usd) : 0;
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

// --- Mobile detection helper ---
function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// --- Wallet flow with deep linking for mobile ---
async function connectSelectedWallet(adapterName) {
  currentWallet = adapters[adapterName];

  // If not installed, open install page instead of trying to connect
  const isInstalled = currentWallet.readyState === WalletReadyState.Installed;
  if (!isInstalled) {
    const installLinks = {
      Phantom: "https://phantom.app/download",
      Solflare: "https://solflare.com/download",
      Glow: "https://glow.app",
    };
    window.open(installLinks[adapterName] || "https://solana.com/ecosystem/wallets?filter=popular", "_blank");
    return;
  }

  try {
    if (isMobile()) {
      // Mobile deep linking logic
      const appUrl = encodeURIComponent(window.location.origin);
      const appName = encodeURIComponent("YourAppName"); // Change to your app name

      let deepLinkUrl = "";

      switch (adapterName) {
        case "Phantom":
          deepLinkUrl = `phantom://connect?app_url=${appUrl}&app_name=${appName}`;
          break;
        case "Solflare":
          deepLinkUrl = `solflare://wallet/connect?app_url=${appUrl}&app_name=${appName}`;
          break;
        case "Glow":
          // Glow has no known deep link; fallback to normal connect
          await currentWallet.connect();
          break;
        default:
          await currentWallet.connect();
      }

      if (deepLinkUrl) {
        window.location.href = deepLinkUrl;
        showNotification("Opening wallet app to connect. Please approve the connection.", "primary");
        return;
      }
    }

    // Desktop or fallback
    await currentWallet.connect();

    currentAddress = currentWallet.publicKey;
    closeModalFn();
    const addressStr = currentAddress.toString();

    setConnectedUI(addressStr);
    await updateBalances(currentAddress);
    showNotification(`Connected: ${shorten(addressStr)}`, "success");

    // Listen for disconnect from wallet UI
    currentWallet.on("disconnect", () => {
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
  window.open("https://solana.com/ecosystem/wallets?filter=popular", "_blank");
});

// Connected dropdown actions
document.addEventListener("click", () => toggleMenu(false)); // click-away to close
walletMenu.addEventListener("click", (e) => e.stopPropagation()); // keep menu open when clicking inside

copyAddressBtn.addEventListener("click", async () => {
  if (!currentAddress) return;
  await navigator.clipboard.writeText(currentAddress.toString());
  showNotification("Address copied!", "success");
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
    statusSubtitle.textContent = "Scanning for opportunities • Last trade: 2 min ago";
    toggleBotBtn.textContent = "Stop Bot";
    toggleBotBtn.classList.add("stop");
    showNotification("Trading bot started", "success");
  } else {
    statusIndicator.classList.add("inactive");
    statusTitle.textContent = "Trading Bot Inactive";
    statusSubtitle.textContent = "Bot stopped • Click start to resume trading";
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
        <h3>Edit ${key.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())}</h3>
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
    if (evt.target === overlay || evt.target.hasAttribute("data-close")) overlay.remove();
  });
  $("#save-setting").addEventListener("click", () => {
    const input = $("#setting-input");
    const newVal = parseFloat(input.value);
    if (isNaN(newVal) || newVal < setting.min || newVal > setting.max) {
      showNotification(`Value must be between ${setting.min} and ${setting.max}`, "warning");
      return;
    }
    setting.value = newVal;
    const prefix = key === "stop-loss" ? "-" : key === "take-profit" ? "+" : "";
    const display = document.getElementById(`${key}-display`);
    display.textContent = `${prefix}${newVal}${unit}`;
    overlay.remove();
    showNotification(`${key.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())} updated`, "success");
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

// Initial setup
document.addEventListener("DOMContentLoaded", () => {
  statusIndicator.classList.add("inactive");
  statusTitle.textContent = "Trading Bot Inactive";
  statusSubtitle.textContent = "Connect wallet to start trading";
  toggleBotBtn.textContent = "Connect Wallet First";
  toggleBotBtn.disabled = true;
  toggleBotBtn.style.opacity = ".5";
  toggleBotBtn.style.cursor = "not-allowed";
  // Mark install status in the modal (best-effort)
  refreshInstallPills();
});

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
const lamportsToSol = (lamports) => (lamports / 1e9);
const $ = (sel) => document.querySelector(sel);

function showNotification(message, type = "primary") {
  const n = document.createElement("div");
  n.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: ${type === "success" ? "var(--success)" : type === "warning" ? "var(--warning)" : type === "danger" ? "var(--danger)" : "var(--primary)"};
    color: white; padding: 1rem 1.5rem; border-radius: .6rem; font-weight: 600; z-index: 2000; box-shadow: 0 10px 30px rgba(0,0,0,.3);
  `;
  n.textContent = message;
  document.body.appendChild(n);
  setTimeout(() => { n.style.opacity = "0"; n.style.transform = "translateX(20px)"; setTimeout(() => n.remove(), 300); }, 2500);
}

function openModal() { walletModal.style.display = "flex"; }
function closeModalFn() { walletModal.style.display = "none"; }
function toggleMenu(show) { walletMenu.style.display = show ? "block" : "none"; }

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
    if (states[name] === WalletReadyState.Installed) {
      pill.textContent = "Installed";
      pill.classList.remove("install");
    } else {
      pill.textContent = "Install";
      pill.classList.add("install");
    }
  });
}

// Price fetch (best-effort; if it fails, keep $0)
async function fetchSolPriceUSD() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
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
    const usdVal = usd ? (sol * usd) : 0;
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
  currentWallet = adapters[adapterName];

  // If not installed, open install page instead of trying to connect
  const isInstalled = currentWallet.readyState === WalletReadyState.Installed;
  if (!isInstalled) {
    const installLinks = {
      Phantom: "https://phantom.app/download",
      Solflare: "https://solflare.com/download",
      Glow: "https://glow.app",
    };
    window.open(installLinks[adapterName] || "https://solana.com/ecosystem/wallets?filter=popular", "_blank");
    return;
  }

  try {
    await currentWallet.connect();
    currentAddress = currentWallet.publicKey;
    closeModalFn();
    const addressStr = currentAddress.toString();

    setConnectedUI(addressStr);
    await updateBalances(currentAddress);
    showNotification(`Connected: ${shorten(addressStr)}`, "success");

    // Listen for disconnect from wallet UI
    currentWallet.on("disconnect", () => {
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
  window.open("https://solana.com/ecosystem/wallets?filter=popular", "_blank");
});

// Connected dropdown actions
document.addEventListener("click", () => toggleMenu(false)); // click-away to close
walletMenu.addEventListener("click", (e) => e.stopPropagation()); // keep menu open when clicking inside

copyAddressBtn.addEventListener("click", async () => {
  if (!currentAddress) return;
  await navigator.clipboard.writeText(currentAddress.toString());
  showNotification("Address copied!", "success");
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
    statusSubtitle.textContent = "Scanning for opportunities • Last trade: 2 min ago";
    toggleBotBtn.textContent = "Stop Bot";
    toggleBotBtn.classList.add("stop");
    showNotification("Trading bot started", "success");
  } else {
    statusIndicator.classList.add("inactive");
    statusTitle.textContent = "Trading Bot Inactive";
    statusSubtitle.textContent = "Bot stopped • Click start to resume trading";
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
        <h3>Edit ${key.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())}</h3>
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
    if (evt.target === overlay || evt.target.hasAttribute("data-close")) overlay.remove();
  });
  $("#save-setting").addEventListener("click", () => {
    const input = $("#setting-input");
    const newVal = parseFloat(input.value);
    if (isNaN(newVal) || newVal < setting.min || newVal > setting.max) {
      showNotification(`Value must be between ${setting.min} and ${setting.max}`, "warning");
      return;
    }
    setting.value = newVal;
    const prefix = key === "stop-loss" ? "-" : key === "take-profit" ? "+" : "";
    const display = document.getElementById(`${key}-display`);
    display.textContent = `${prefix}${newVal}${unit}`;
    overlay.remove();
    showNotification(`${key.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())} updated`, "success");
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

// Initial setup
document.addEventListener("DOMContentLoaded", () => {
  statusIndicator.classList.add("inactive");
  statusTitle.textContent = "Trading Bot Inactive";
  statusSubtitle.textContent = "Connect wallet to start trading";
  toggleBotBtn.textContent = "Connect Wallet First";
  toggleBotBtn.disabled = true;
  toggleBotBtn.style.opacity = ".5";
  toggleBotBtn.style.cursor = "not-allowed";
  // Mark install status in the modal (best-effort)
  refreshInstallPills();
});

