/* ====================================================================
   $PIXBALL — launch config
   --------------------------------------------------------------------
   When the token launches, paste the real contract address into CA.
   Everything else (Pump.fun, Dexscreener, copy button) updates itself.
   ==================================================================== */

const CA    = "SOON";              // <-- paste real contract address here
const X_URL = "https://x.com/pixball_sol";

/* ---- derived, do not edit ---- */
const HAS_CA   = CA && CA !== "COMING SOON";
const PUMP_URL = HAS_CA ? `https://pump.fun/coin/${CA}` : "#";
const DEX_URL  = HAS_CA ? `https://dexscreener.com/solana/${CA}` : "#";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("caVal").textContent = CA;
  document.getElementById("xLink").href  = X_URL;
  document.getElementById("xLink2").href = X_URL;
  document.getElementById("pumpLink").href = PUMP_URL;
  document.getElementById("dexLink").href  = DEX_URL;

  const caBtn = document.getElementById("ca");
  caBtn.addEventListener("click", () => {
    if (!HAS_CA) return;
    navigator.clipboard.writeText(CA);
    const v = document.getElementById("caVal");
    const prev = v.textContent;
    v.textContent = "copied";
    setTimeout(() => (v.textContent = prev), 1100);
  });
});
