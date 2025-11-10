import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

/*
  Bond Assessment Tool
  - Numeric inputs paired with pill-shaped sliders
  - Multi-line comparison graph (price curves, with optional callable approximation)
  - Radio buttons for bond type & coupon frequency
  - Checkboxes for provisions (callable, putable, sinking fund, convertible)
  - Modern high-contrast aesthetic (not neobrutalist; more contrast than neumorphism)

  Libraries assumed available by the canvas runtime:
   - React, framer-motion, recharts, Tailwind (no explicit import needed for Tailwind)
*/

// ---------- Utility functions ---------- //
function priceBond({ face = 1000, couponRate = 0.05, ytm = 0.05, years = 10, freq = 2 }) {
  // Price a plain-vanilla fixed-rate bond.
  // couponRate and ytm expressed as decimals. freq = payments per year.
  const n = Math.max(1, Math.round(years * freq));
  const c = (couponRate * face) / freq;
  const r = ytm / freq;
  let pvCoupons = 0;
  for (let t = 1; t <= n; t++) pvCoupons += c / Math.pow(1 + r, t);
  const pvFace = face / Math.pow(1 + r, n);
  return pvCoupons + pvFace;
}

function macaulayDuration({ face = 1000, couponRate = 0.05, ytm = 0.05, years = 10, freq = 2 }) {
  // Macaulay Duration in years for a level-coupon bond
  const n = Math.max(1, Math.round(years * freq));
  const c = (couponRate * face) / freq;
  const r = ytm / freq;
  const price = priceBond({ face, couponRate, ytm, years, freq });
  let num = 0;
  for (let t = 1; t <= n; t++) {
    const tYears = t / freq;
    const cf = t === n ? c + face : c;
    num += (tYears * cf) / Math.pow(1 + r, t);
  }
  const dur = num / price;
  return dur; // years
}

function modifiedDuration(args) {
  const Dmac = macaulayDuration(args);
  const r = args.ytm / args.freq;
  return Dmac / (1 + r);
}

function yieldToWorstApprox({
  face = 1000,
  couponRate = 0.05,
  ytm = 0.05,
  years = 10,
  freq = 2,
  callable = false,
  callYears = 5,
  callPrice = 1000,
}) {
  if (!callable) return ytm;
  // Very simple YTW approximation: compare current YTM vs a rough YTC implied by pricing at call date and call price,
  // using the bond's market price under YTM to reverse-engineer.
  const marketPrice = priceBond({ face, couponRate, ytm, years, freq });
  const n = Math.max(1, Math.round(callYears * freq));
  const c = (couponRate * face) / freq;
  // Solve for r such that marketPrice = PV(coupons to call) + PV(call price)
  // Use a quick Newton-Raphson / bisection hybrid on per-period rate.
  const target = marketPrice;
  let lo = -0.99, hi = 1.0; // per period search bounds
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    const r = mid;
    let pv = 0;
    for (let t = 1; t <= n; t++) pv += c / Math.pow(1 + r, t);
    pv += callPrice / Math.pow(1 + r, n);
    if (pv > target) lo = mid; else hi = mid;
  }
  const rMid = (lo + hi) / 2;
  const ytc = Math.max(-0.99, (Math.pow(1 + rMid, freq) - 1));
  return Math.min(ytm, ytc);
}

// Formatters
const fmtPct = (v) => `${(v * 100).toFixed(2)}%`;
const fmtMoney = (v) => v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

// ---------- Slider + Input control ---------- //
function LabeledSlider({ label, min, max, step, value, onChange, suffix = "", toFixed = 2 }) {
  return (
    <div className="w-full">
      <div className="flex items-end justify-between mb-1">
        <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</label>
        <div className="flex items-center gap-2">
          <input
            className="w-28 px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/90 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
            type="number"
            step={step}
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="text-xs text-neutral-600 dark:text-neutral-400 select-none">{suffix}</span>
        </div>
      </div>
      <div className="py-2">
        <Range value={value} min={min} max={max} step={step} onChange={onChange} />
      </div>
    </div>
  );
}

function Range({ value, min, max, step, onChange }) {
  return (
    <div className="relative w-full">
      <input
        type="range"
        className="w-full appearance-none h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full outline-none"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          // Chrome
          WebkitAppearance: "none",
        }}
      />
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 36px; height: 18px; border-radius: 9999px; /* pill handle */
          background: linear-gradient(180deg, #ffffff, #e6e6e6);
          border: 1px solid #bfbfbf;
          box-shadow: 0 1px 0 rgba(0,0,0,0.1);
          cursor: pointer;
          margin-top: -8px; /* vertically center on 2px track */
        }
        input[type=range]::-moz-range-thumb {
          width: 36px; height: 18px; border-radius: 9999px;
          background: linear-gradient(180deg, #ffffff, #e6e6e6);
          border: 1px solid #bfbfbf;
          box-shadow: 0 1px 0 rgba(0,0,0,0.1);
          cursor: pointer;
        }
        input[type=range]::-ms-thumb {
          width: 36px; height: 18px; border-radius: 9999px;
          background: linear-gradient(180deg, #ffffff, #e6e6e6);
          border: 1px solid #bfbfbf;
          box-shadow: 0 1px 0 rgba(0,0,0,0.1);
          cursor: pointer;
        }
        input[type=range]::-webkit-slider-runnable-track {
          height: 2px; border-radius: 9999px;
          background: linear-gradient(90deg, #111827 0%, #4f46e5 100%);
        }
        input[type=range]::-moz-range-track {
          height: 2px; border-radius: 9999px; background: #111827;
        }
      `}</style>
    </div>
  );
}

// ---------- Main component ---------- //
export default function BondAssessmentTool() {
  const [face, setFace] = useState(1000);
  const [couponPct, setCouponPct] = useState(5.0);
  const [ytmPct, setYtmPct] = useState(5.0);
  const [years, setYears] = useState(10);
  const [freq, setFreq] = useState(2); // 1,2,4,12
  const [bondType, setBondType] = useState("corporate"); // treasury | corporate | muni

  const [callable, setCallable] = useState(false);
  const [putable, setPutable] = useState(false);
  const [sinking, setSinking] = useState(false);
  const [convertible, setConvertible] = useState(false);

  const computed = useMemo(() => {
    const couponRate = couponPct / 100;
    const ytm = ytmPct / 100;

    const baseArgs = { face, couponRate, ytm, years, freq };
    const price = priceBond(baseArgs);
    const Dmac = macaulayDuration(baseArgs);
    const Dmod = modifiedDuration(baseArgs);
    const cy = (couponRate * face) / price; // current yield

    const ytw = yieldToWorstApprox({
      face,
      couponRate,
      ytm,
      years,
      freq,
      callable,
      callYears: Math.min(years, Math.max(2, Math.round(years / 2))),
      callPrice: face,
    });

    // Build the comparison dataset: price vs yield curve around current YTM
    const points = [];
    for (let bps = -200; bps <= 200; bps += 10) {
      const y = Math.max(0.0001, ytm + bps / 10000);
      const p = priceBond({ face, couponRate, ytm: y, years, freq });
      let pCallable = p;
      if (callable) {
        // Approximate callable effect by using YTW at each grid point: compare to a simple YTC from that y
        const ytwGrid = yieldToWorstApprox({ face, couponRate, ytm: y, years, freq, callable, callYears: Math.min(years, Math.max(2, Math.round(years / 2))), callPrice: face });
        pCallable = priceBond({ face, couponRate, ytm: ytwGrid, years, freq });
      }
      points.push({
        yld: y * 100,
        Price: p,
        "Price (Callable est)": pCallable,
      });
    }

    return { price, Dmac, Dmod, cy, ytw, points };
  }, [face, couponPct, ytmPct, years, freq, callable]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 text-neutral-900 dark:text-neutral-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-2xl md:text-3xl font-semibold tracking-tight"
        >
          Bond Assessment Tool
        </motion.h1>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="lg:col-span-5 bg-white/80 dark:bg-neutral-950/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
          >
            <h2 className="text-lg font-semibold mb-4">Inputs</h2>
            <div className="space-y-5">
              <LabeledSlider label="Face Value" min={100} max={10000} step={50} value={face} onChange={setFace} suffix="USD" />
              <LabeledSlider label="Coupon Rate" min={0} max={15} step={0.1} value={couponPct} onChange={setCouponPct} suffix="%" />
              <LabeledSlider label="Yield to Maturity" min={0} max={20} step={0.1} value={ytmPct} onChange={setYtmPct} suffix="%" />
              <LabeledSlider label="Years to Maturity" min={0.5} max={40} step={0.5} value={years} onChange={setYears} suffix="yrs" />

              {/* Radios */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Bond Type</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "treasury", label: "Treasury" },
                      { id: "corporate", label: "Corporate" },
                      { id: "muni", label: "Municipal" },
                    ].map((o) => (
                      <label key={o.id} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer select-none transition ${bondType===o.id?"border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30":"border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"}`}>
                        <input type="radio" name="bondType" className="hidden" checked={bondType===o.id} onChange={()=>setBondType(o.id)} />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Coupon Frequency</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 1, label: "Annual" },
                      { id: 2, label: "Semi" },
                      { id: 4, label: "Quarterly" },
                      { id: 12, label: "Monthly" },
                    ].map((o) => (
                      <label key={o.id} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer select-none transition ${freq===o.id?"border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30":"border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"}`}>
                        <input type="radio" name="freq" className="hidden" checked={freq===o.id} onChange={()=>setFreq(o.id)} />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Provisions */}
              <div>
                <div className="text-sm font-medium mb-2">Optional Provisions</div>
                <div className="grid grid-cols-2 gap-2">
                  <Checkbox label="Callable" checked={callable} onChange={setCallable} />
                  <Checkbox label="Putable" checked={putable} onChange={setPutable} />
                  <Checkbox label="Sinking Fund" checked={sinking} onChange={setSinking} />
                  <Checkbox label="Convertible" checked={convertible} onChange={setConvertible} />
                </div>
                <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">Note: Callable pricing is approximated via a yield-to-worst estimate using a midpoint call date.</p>
              </div>
            </div>
          </motion.section>

          {/* Chart + Metrics */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="bg-white/80 dark:bg-neutral-950/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h2 className="text-lg font-semibold mb-4">Price vs Yield Comparison</h2>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={computed.points} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="yld" tickFormatter={(v)=>`${v.toFixed(2)}%`} label={{ value: "Yield (%)", position: "insideBottom", dy: 12 }} />
                    <YAxis yAxisId="left" tickFormatter={(v)=>`$${Math.round(v)}`} label={{ value: "Price ($)", angle: -90, position: "insideLeft" }} />
                    <Tooltip formatter={(val, name) => [fmtMoney(Number(val)), name]} labelFormatter={(l)=>`Yield: ${l.toFixed(2)}%`} />
                    <Legend />
                    <ReferenceLine yAxisId="left" y={face} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Par", position: "insideTopLeft", fill: "#10b981" }} />
                    <Line yAxisId="left" type="monotone" dataKey="Price" stroke="#4f46e5" strokeWidth={2.5} dot={false} name="Price (Non-call)" />
                    <Line yAxisId="left" type="monotone" dataKey="Price (Callable est)" stroke="#ef4444" strokeWidth={2} dot={false} name="Price (Callable est)" hide={!callable} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MetricCard title="Model Price" value={fmtMoney(computed.price)} subtitle={`at YTM ${ytmPct.toFixed(2)}%, ${freq}x/yr`} />
              <MetricCard title="Current Yield" value={fmtPct(computed.cy)} subtitle="Coupon / Price" />
              <MetricCard title="Macaulay Duration" value={`${computed.Dmac.toFixed(2)} yrs`} subtitle="Interest-rate sensitivity (time-weighted)" />
              <MetricCard title="Modified Duration" value={`${computed.Dmod.toFixed(2)} yrs"`} subtitle="Approx. %ΔPrice for 1% ΔYTM" />
              {callable && (
                <MetricCard title="Yield to Worst (est)" value={`${(computed.ytw*100).toFixed(2)}%`} subtitle="Callable approximation" />
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition select-none ${checked?"border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30":"border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"}`}>
      <input type="checkbox" className="accent-indigo-600" checked={checked} onChange={(e)=>onChange(e.target.checked)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function MetricCard({ title, value, subtitle }) {
  return (
    <div className="bg-white/80 dark:bg-neutral-950/60 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="text-sm text-neutral-600 dark:text-neutral-400">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {subtitle && <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">{subtitle}</div>}
    </div>
  );
}
