import { useState, useEffect, useRef, useMemo } from "react";
import { db } from "./firebase.js";
import { ref, set, onValue } from "firebase/database";

const PASSWORD       = "FalconsU12";
const RESET_PASSWORD = "Thomas";

// ─── Hardcoded Day 1 schedule ───────────────────────────────────
const DAY1_G1 = {
  teams: ["Falcons Black", "Falcons Grey", "Stoczniowiec", "Utrecht Dragons", "Neuchâtel", "Bad Boyz Black"],
  games: [
    { id:"g1_0", time:"07:00", team1:"Falcons Black",    team2:"Stoczniowiec",          s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g1_1", time:"07:40", team1:"Falcons Grey",     team2:"Utrecht Dragons", s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g1_2", time:"08:35", team1:"Neuchâtel",       team2:"Bad Boyz Black",      s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g1_3", time:"09:15", team1:"Falcons Black",    team2:"Utrecht Dragons", s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g1_4", time:"10:10", team1:"Falcons Grey",     team2:"Stoczniowiec",          s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g1_5", time:"10:50", team1:"Falcons Black",    team2:"Neuchâtel",       s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g1_6", time:"11:45", team1:"Utrecht Dragons", team2:"Bad Boyz Black",      s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g1_7", time:"12:25", team1:"Stoczniowiec",          team2:"Neuchâtel",       s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g1_8", time:"13:20", team1:"Falcons Grey",     team2:"Bad Boyz Black",      s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
  ]
};

const DAY1_G2 = {
  teams: ["Crocodiles", "Bad Boyz Orange", "Torun", "Sostines", "Stjernen", "CEHA"],
  games: [
    { id:"g2_0", time:"14:00", team1:"Crocodiles", team2:"Bad Boyz Orange", s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g2_1", time:"14:55", team1:"Torun",      team2:"Sostines",   s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g2_2", time:"15:35", team1:"Stjernen",   team2:"CEHA",       s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g2_3", time:"16:30", team1:"Crocodiles", team2:"Sostines",   s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g2_4", time:"17:10", team1:"Torun",      team2:"Bad Boyz Orange", s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g2_5", time:"18:05", team1:"Crocodiles", team2:"Stjernen",   s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g2_6", time:"18:45", team1:"Sostines",   team2:"CEHA",       s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g2_7", time:"19:40", team1:"Bad Boyz Orange", team2:"Stjernen",   s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
    { id:"g2_8", time:"20:20", team1:"Torun",      team2:"CEHA",       s1:"", s2:"", soResult:null, pim1:0, pim2:0 },
  ]
};

// ─── Day 2 cross-group schedules ────────────────────────────────
// teams array = [M1,M2,M3, A1,A2,A3] — indices 0-2 are Group 1 finishers (M),
// indices 3-5 are Group 2 finishers (A). Every M plays every A, never M vs M.
// Grupp B (bottom 3+3) plays in the morning, Grupp A (top 3+3) in the afternoon.
const DAY2_GRUPP_B_SCHED = [
  [2,5,"07:00"], [1,4,"07:40"], [0,3,"08:35"],
  [2,4,"09:15"], [1,3,"10:10"], [0,5,"10:50"],
  [2,3,"11:45"], [1,5,"12:25"], [0,4,"13:20"],
];

const DAY2_GRUPP_A_SCHED = [
  [0,3,"14:00"], [1,4,"14:55"], [2,5,"15:35"],
  [0,4,"16:30"], [1,5,"17:10"], [2,3,"18:05"],
  [0,5,"18:45"], [1,3,"19:40"], [2,4,"20:20"],
];

const makeDay2Games = (teams, sched, pfx) =>
  sched.map(([i,j,time], k) => ({ id:`${pfx}${k}`, time, team1:teams[i], team2:teams[j], s1:"", s2:"", soResult:null, pim1:0, pim2:0 }));

// ─── Pure helpers ───────────────────────────────────────────────
// Unequal scores → played immediately (ot flag just affects points).
// Equal scores → played only once a soResult is chosen ('team1' | 'tie' | 'team2').
const played = g => {
  if (!g?.team1 || g.s1 === "" || g.s2 === "") return false;
  if (isNaN(+g.s1) || isNaN(+g.s2) || +g.s1 < 0 || +g.s2 < 0) return false;
  if (+g.s1 !== +g.s2) return true;
  return g.soResult === "team1" || g.soResult === "tie" || g.soResult === "team2";
};

const isDraw = g => played(g) && +g.s1 === +g.s2 && g.soResult === "tie";

const winner = g => {
  if (!played(g)) return null;
  const [a, b] = [+g.s1, +g.s2];
  if (a > b) return g.team1;
  if (b > a) return g.team2;
  if (g.soResult === "team1") return g.team1;
  if (g.soResult === "team2") return g.team2;
  return null;
};

const loser = g => {
  if (!played(g)) return null;
  const [a, b] = [+g.s1, +g.s2];
  if (a > b) return g.team2;
  if (b > a) return g.team1;
  if (g.soResult === "team1") return g.team2;
  if (g.soResult === "team2") return g.team1;
  return null;
};

// ─── Head-to-head tiebreaker ────────────────────────────────────
// Returns +1 if teamA beat teamB, -1 if teamB beat teamA, 0 if not played / draw
// prevGames is an optional fallback (e.g. Day 1 games) used only if no current-group result exists
function headToHead(teamA, teamB, games, prevGames = []) {
  const find = (arr) => arr.find(g =>
    played(g) && (
      (g.team1 === teamA && g.team2 === teamB) ||
      (g.team1 === teamB && g.team2 === teamA)
    )
  );
  const g = find(games) || find(prevGames);
  if (!g) return 0;
  const w = winner(g);
  if (w === teamA) return 1;
  if (w === teamB) return -1;
  return 0; // SO draw
}

// ─── Complete tie detection ──────────────────────────────────────
function isCompletelyTied(a, b, games, prevGames) {
  if (a.pts !== b.pts) return false;
  if (headToHead(a.team, b.team, games, prevGames) !== 0) return false;
  if ((a.gf - a.ga) !== (b.gf - b.ga)) return false;
  if (a.gf !== b.gf) return false;
  if (a.pim !== b.pim) return false;
  return true;
}

const swapKey = (a, b) => [a, b].sort().join('|||');

function calcStandings(teams, games, prevGames = [], swaps = {}) {
  const r = {};
  teams.forEach(t => r[t] = { team:t, pts:0, gp:0, w:0, otw:0, t:0, otl:0, l:0, gf:0, ga:0, pim:0 });
  games.filter(played).forEach(g => {
    if (!r[g.team1] || !r[g.team2]) return;
    const [a, b] = [+g.s1, +g.s2];
    const [p, q] = [r[g.team1], r[g.team2]];
    p.gp++; q.gp++; p.gf += a; p.ga += b; q.gf += b; q.ga += a;
    p.pim += (g.pim1 || 0); q.pim += (g.pim2 || 0);
    if (a === b) {
      if (g.soResult === "tie")        { p.t++;   p.pts++;    q.t++;   q.pts++;    }
      else if (g.soResult === "team1") { p.otw++; p.pts += 2; q.otl++; q.pts++;   }
      else if (g.soResult === "team2") { q.otw++; q.pts += 2; p.otl++; p.pts++;   }
    } else if (a > b) {
      p.w++; p.pts += 3; q.l++;
    } else {
      q.w++; q.pts += 3; p.l++;
    }
  });
  const sorted = Object.values(r).sort((a, b) => {
    if (b.pts !== a.pts)                          return b.pts - a.pts;
    const h2h = headToHead(b.team, a.team, games, prevGames);
    if (h2h !== 0)                                return h2h;
    const gdDiff = (b.gf - b.ga) - (a.gf - a.ga);
    if (gdDiff !== 0)                             return gdDiff;
    if (b.gf !== a.gf)                            return b.gf - a.gf;
    if (a.pim !== b.pim)                           return a.pim - b.pim;
    return a.team.localeCompare(b.team, undefined, {numeric:true});
  });
  // Apply manual coin-flip overrides for completely tied adjacent pairs (bubble until stable)
  if (Object.keys(swaps).length > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (isCompletelyTied(sorted[i], sorted[i+1], games, prevGames)) {
          const k = swapKey(sorted[i].team, sorted[i+1].team);
          if (swaps[k] && swaps[k] !== sorted[i].team) {
            [sorted[i], sorted[i+1]] = [sorted[i+1], sorted[i]];
            changed = true;
          }
        }
      }
    }
  }
  return sorted;
}

const makePlayoffGames = (seeds, pfx, times) => {
  const [s1,s2,s3,s4] = seeds;
  const [t1,t2,tb,tg] = times;
  return [
    { id:`${pfx}sf1`, label:"Semi-Final 1", time:t1, team1:s1, team2:s4, s1:"", s2:"", ot:false, soResult:null, pim1:0, pim2:0 },
    { id:`${pfx}sf2`, label:"Semi-Final 2", time:t2, team1:s2, team2:s3, s1:"", s2:"", ot:false, soResult:null, pim1:0, pim2:0 },
    { id:`${pfx}b`,   label:"Bronze Medal", time:tb, team1:null, team2:null, s1:"", s2:"", ot:false, soResult:null, pim1:0, pim2:0 },
    { id:`${pfx}g`,   label:"Gold Medal",   time:tg, team1:null, team2:null, s1:"", s2:"", ot:false, soResult:null, pim1:0, pim2:0 },
  ];
};

function refreshFinals(games) {
  const g = [...games];
  if (played(g[0]) && played(g[1])) {
    g[2] = { ...g[2], team1:loser(g[0]),   team2:loser(g[1]),   s1:"", s2:"" };
    g[3] = { ...g[3], team1:winner(g[0]), team2:winner(g[1]), s1:"", s2:"" };
  } else {
    g[2] = { ...g[2], team1:null, team2:null, s1:"", s2:"", soResult:null, pim1:0, pim2:0 };
    g[3] = { ...g[3], team1:null, team2:null, s1:"", s2:"", soResult:null, pim1:0, pim2:0 };
  }
  return g;
}

// ─── Game Row ──────────────────────────────────────────────────
function GameRow({ game, onUpdate, isPlayoff = false, locked = false }) {
  if (!game.team1) return (
    <div className="flex items-center justify-center py-2 px-3 rounded-lg mb-1.5 border border-dashed"
      style={{ borderColor:"#2a3a5c", color:"#4a5a7c", fontSize:12 }}>
      TBD vs TBD
    </div>
  );

  const done      = played(game);
  const draw      = done && isDraw(game);
  const [a, b]    = [+game.s1, +game.s2];

  // Scores are both filled and equal — SO picker should show
  const bothFilled  = game.s1 !== "" && game.s2 !== "" && !isNaN(+game.s1) && !isNaN(+game.s2) && +game.s1 >= 0 && +game.s2 >= 0;
  const scoresEqual = bothFilled && +game.s1 === +game.s2;
  const soOptions   = scoresEqual; // always show SO picker when tied, regardless of soResult

  // Playoff draw warning (SO tie not allowed in playoffs)
  const playoffDrawWarning = isPlayoff && scoresEqual && game.soResult === "tie";

  const rowBg     = draw ? "rgba(251,191,36,0.07)" : done ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)";
  const rowBorder = draw ? "rgba(251,191,36,0.3)"  : done ? "rgba(34,197,94,0.3)"  : "rgba(255,255,255,0.08)";

  return (
    <div style={{ marginBottom:"6px" }}>
      {/* Score row */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
        style={{ background: rowBg, borderColor: rowBorder, opacity: locked ? 0.75 : 1 }}>
        {game.time && (
          <span style={{ fontSize:10, fontWeight:700, color:"#3a5a8c", fontFamily:"'DM Mono', monospace", minWidth:34, flexShrink:0 }}>
            {game.time}
          </span>
        )}
        <span className="flex-1 text-right truncate" style={{
          fontSize:12, fontWeight: done && !draw && a > b ? 700 : 500,
          color: draw ? "#fbbf24" : (done && a > b) ? "#4ade80" : "#c8d8f0",
        }}>
          {game.team1}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <input type="number" min="0" value={game.s1} className="score-input"
            disabled={locked} style={locked ? {cursor:"not-allowed",opacity:0.5} : {}}
            onChange={e => onUpdate("s1", e.target.value)} />
          <span style={{ color:"#4a5a7c", fontWeight:700, fontSize:16 }}>–</span>
          <input type="number" min="0" value={game.s2} className="score-input"
            disabled={locked} style={locked ? {cursor:"not-allowed",opacity:0.5} : {}}
            onChange={e => onUpdate("s2", e.target.value)} />
        </div>
        <span className="flex-1 truncate" style={{
          fontSize:12, fontWeight: done && !draw && b > a ? 700 : 500,
          color: draw ? "#fbbf24" : (done && b > a) ? "#4ade80" : "#c8d8f0",
        }}>
          {game.team2}
        </span>
        {/* Right side: SO result badge when tied, nothing when unequal */}
        {scoresEqual
          ? game.soResult
            ? <span className="shrink-0 px-1.5 py-0.5 rounded font-bold" style={{
                fontSize:9, letterSpacing:"0.05em",
                background: draw ? "rgba(251,191,36,0.15)" : "rgba(34,197,94,0.15)",
                color:      draw ? "#fbbf24"               : "#4ade80",
              }}>
                {game.soResult === "tie"   ? "SO TIE"
               : game.soResult === "team1" ? `${game.team1} SO`
               :                            `${game.team2} SO`}
              </span>
            : <span style={{ fontSize:9, color:"#3a5a8c", width:40, textAlign:"right" }}>SO?</span>
          : null
        }
      </div>

      {/* Shootout picker — appears whenever scores are equal */}
      {soOptions && (
        <div style={{ display:"flex", gap:6, marginTop:4 }}>
          {[
            { val:"team1", label: game.team1, color:"#4ade80", bg:"rgba(34,197,94,0.12)", border:"rgba(34,197,94,0.3)" },
            { val:"tie",   label:"SO Tie",    color:"#fbbf24", bg:"rgba(251,191,36,0.12)", border:"rgba(251,191,36,0.3)" },
            { val:"team2", label: game.team2, color:"#4ade80", bg:"rgba(34,197,94,0.12)", border:"rgba(34,197,94,0.3)" },
          ].map(opt => {
            const selected = game.soResult === opt.val;
            return (
              <button key={opt.val} disabled={locked}
                onClick={() => onUpdate("soResult", selected ? null : opt.val)}
                style={{
                  flex:1, padding:"5px 4px", borderRadius:8,
                  border: `1px solid ${selected ? opt.border : "rgba(255,255,255,0.07)"}`,
                  background: selected ? opt.bg : "rgba(255,255,255,0.03)",
                  color: selected ? opt.color : "#4a5a7c",
                  fontSize:10, fontWeight: selected ? 700 : 500,
                  cursor: locked ? "not-allowed" : "pointer",
                  fontFamily:"'DM Sans', sans-serif",
                  transition:"all 0.12s",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>
                {opt.val === "team1" ? `↑ ${opt.label}` : opt.val === "team2" ? `↑ ${opt.label}` : opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* PIM row — shown once a result is entered */}
      {done && (
        <div className="flex items-center gap-2 px-3 py-1.5" style={{ opacity: locked ? 0.6 : 1 }}>
          <span style={{ fontSize:9, color:"#3a5a8c", fontWeight:700, letterSpacing:"0.06em", minWidth:34 }}>PIM</span>
          <div className="flex items-center gap-1 flex-1 justify-end">
            <span style={{ fontSize:10, color:"#4a5a7c", textAlign:"right", flex:1 }} className="truncate">{game.team1}</span>
            <input type="number" min="0" value={game.pim1 ?? 0}
              className="score-input" disabled={locked}
              style={{ width:36, fontSize:12, ...(locked ? {cursor:"not-allowed", opacity:0.5} : {}) }}
              onFocus={e => e.target.select()}
              onChange={e => onUpdate("pim1", Math.max(0, +e.target.value || 0))} />
          </div>
          <div className="flex items-center gap-1 flex-1">
            <input type="number" min="0" value={game.pim2 ?? 0}
              className="score-input" disabled={locked}
              style={{ width:36, fontSize:12, ...(locked ? {cursor:"not-allowed", opacity:0.5} : {}) }}
              onFocus={e => e.target.select()}
              onChange={e => onUpdate("pim2", Math.max(0, +e.target.value || 0))} />
            <span style={{ fontSize:10, color:"#4a5a7c", flex:1 }} className="truncate">{game.team2}</span>
          </div>
        </div>
      )}

      {playoffDrawWarning && (
        <p style={{ textAlign:"center", marginTop:4, fontSize:10, color:"#f87171" }}>
          ⚠ SO ties not allowed in playoffs — pick a winner
        </p>
      )}
    </div>
  );
}

// ─── Standings Table ───────────────────────────────────────────
function StandingsTable({ teams, games, cutAt, topTag, botTag, prevGames = [], swaps = {}, onSwap, locked = true }) {
  const rows = useMemo(
    () => calcStandings(teams, games, prevGames, swaps),
    [teams, games, prevGames, swaps] // eslint-disable-line
  );
  return (
    <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
    <div className="rounded-lg overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.06)", minWidth:480 }}>
      <table className="w-full" style={{ fontSize:11, borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ background:"rgba(0,0,0,0.3)", color:"#4a6a9c" }}>
            <th className="text-left px-2 py-1.5">#</th>
            <th className="text-left px-2 py-1.5">Team</th>
            {["GP","W","OW","T","OL","L","GF","GA","PIM"].map(h => (
              <th key={h} className="px-1 py-1.5 text-center"
                style={h==="T" ? {color:"#fbbf24"} : h==="PIM" ? {color:"#f87171"} : {}}>{h}</th>
            ))}
            <th className="px-2 py-1.5 text-center" style={{ color:"#7cb8ff", fontWeight:700 }}>PTS</th>
            {cutAt && <th className="px-2 py-1.5 text-center" style={{ color:"#60a5fa" }}>→</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const isTop = cutAt && i < cutAt;
            const isBot = cutAt && i >= cutAt;
            const nextRow = rows[i + 1];
            const tied = !locked && nextRow && isCompletelyTied(s, nextRow, games, prevGames);
            const colSpan = 11 + (cutAt ? 1 : 0);
            return (
              <>
                <tr key={s.team} style={{
                  borderBottom: tied ? "none" : "1px solid rgba(255,255,255,0.04)",
                  background: isTop ? "rgba(52,211,153,0.06)" : isBot ? "rgba(251,146,60,0.06)" : "transparent",
                }}>
                  <td className="px-2 py-1.5" style={{ color:"#4a5a7c" }}>{i+1}</td>
                  <td className="px-2 py-1.5 font-medium truncate" style={{ maxWidth:90, color:"#c8d8f0" }}>{s.team}</td>
                  {[s.gp,s.w,s.otw,s.t,s.otl,s.l,s.gf,s.ga,s.pim].map((v, j) => (
                    <td key={j} className="px-1 py-1.5 text-center"
                      style={{ color: j===3 && v>0 ? "#fbbf24" : j===8 && v>0 ? "#f87171" : "#8aa0c8" }}>{v}</td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-bold" style={{ color:"#7cb8ff", fontSize:13 }}>{s.pts}</td>
                  {cutAt && (
                    <td className="px-2 py-1.5 text-center font-semibold" style={{
                      fontSize:10, color: isTop ? "#34d399" : "#fb923c"
                    }}>
                      {isTop ? topTag : botTag}
                    </td>
                  )}
                </tr>
                {tied && (
                  <tr key={`tie-${s.team}`} style={{ background:"rgba(251,191,36,0.05)" }}>
                    <td colSpan={colSpan} style={{ padding:"3px 8px", textAlign:"center" }}>
                      <button
                        onClick={() => {
                          const k = swapKey(s.team, nextRow.team);
                          const cur = swaps[k];
                          onSwap(k, cur === s.team ? nextRow.team : s.team);
                        }}
                        style={{
                          background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.3)",
                          borderRadius:6, padding:"2px 10px", cursor:"pointer",
                          color:"#fbbf24", fontSize:9, fontWeight:700, letterSpacing:"0.06em",
                          fontFamily:"'DM Sans', sans-serif",
                        }}>
                        🪙 EQUAL — TAP TO SWAP ORDER
                      </button>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}

// ─── Group Panel ──────────────────────────────────────────────
function GroupPanel({ title, accent, teams, games, onGamesChange, cutAt, topTag, botTag, locked, reorderable, prevGames = [], swaps = {}, onSwap }) {
  const upd      = (i, f, v) => onGamesChange(games.map((g, j) => j===i ? {...g,[f]:v} : g));
  const doneCount = games.filter(played).length;
  const canDrag   = !!reorderable;

  const [dragSrc,  setDragSrc]  = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Refs so non-React event listeners never capture stale values
  const dragRef     = useRef({ active:false, src:null, over:null });
  const gamesRef    = useRef(games);
  const onChgRef    = useRef(onGamesChange);
  const containerRef = useRef(null);
  useEffect(() => { gamesRef.current = games;          });
  useEffect(() => { onChgRef.current = onGamesChange;  });

  const performReorder = (from, to) => {
    if (from === null || to === null || from === to) return;
    const g     = gamesRef.current;
    const times = g.map(x => x.time);
    const arr   = [...g];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChgRef.current(arr.map((x, k) => ({ ...x, time: times[k] })));
  };

  // ── Desktop: HTML5 drag ──────────────────────────────────────
  const onDragStart = (i)    => { dragRef.current.src = i; setDragSrc(i); };
  const onDragOver  = (e, i) => { e.preventDefault(); setDragOver(i); };
  const onDrop      = (i)    => { performReorder(dragRef.current.src, i); setDragSrc(null); setDragOver(null); };
  const onDragEnd   = ()     => { setDragSrc(null); setDragOver(null); };

  // ── Mobile: non-passive touch listeners on the container ─────
  // onTouchStart is attached via React to the drag handle only
  const handleTouchStart = (i) => {
    dragRef.current = { active:true, src:i, over:i };
    setDragSrc(i); setDragOver(i);
  };

  useEffect(() => {
    if (!canDrag) return;
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e) => {
      if (!dragRef.current.active) return;
      e.preventDefault(); // prevents page scroll while dragging
      const { clientX, clientY } = e.touches[0];
      const target = document.elementFromPoint(clientX, clientY);
      const row    = target?.closest('[data-di]');
      if (row) {
        const idx = +row.getAttribute('data-di');
        if (!isNaN(idx) && idx !== dragRef.current.over) {
          dragRef.current.over = idx;
          setDragOver(idx);
        }
      }
    };

    const onEnd = () => {
      if (!dragRef.current.active) return;
      const { src, over } = dragRef.current;
      dragRef.current = { active:false, src:null, over:null };
      setDragSrc(null); setDragOver(null);
      performReorder(src, over);
    };

    el.addEventListener('touchmove',   onMove, { passive:false });
    el.addEventListener('touchend',    onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchmove',   onMove);
      el.removeEventListener('touchend',    onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [canDrag]); // eslint-disable-line

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background:"#0d1b2e", border:"1px solid rgba(255,255,255,0.07)" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: accent }}>
        <span className="font-bold text-white" style={{ fontSize:15 }}>{title}</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {canDrag && (
            <span style={{ fontSize:9, color:"rgba(255,255,255,0.55)", fontWeight:600, letterSpacing:"0.08em" }}>
              DRAG TO REORDER
            </span>
          )}
          <span className="text-white text-xs font-medium opacity-80">{doneCount}/9 games</span>
        </div>
      </div>
      <div ref={containerRef} className="p-4">
        <p className="uppercase tracking-widest mb-2" style={{ fontSize:9, color:"#3a5a8c", fontWeight:700 }}>Games</p>
        {games.map((g, i) => (
          <div
            key={g.id}
            data-di={i}
            draggable={canDrag}
            onDragStart={canDrag ? () => onDragStart(i) : undefined}
            onDragOver={canDrag  ? (e) => onDragOver(e, i) : undefined}
            onDrop={canDrag      ? () => onDrop(i) : undefined}
            onDragEnd={canDrag   ? onDragEnd : undefined}
            style={{
              display:"flex", alignItems:"center", gap:4, borderRadius:10,
              outline: dragOver === i && dragSrc !== i ? "2px solid rgba(100,160,255,0.7)" : "2px solid transparent",
              outlineOffset: 1,
              opacity: dragSrc === i ? 0.35 : 1,
              transition:"outline 0.08s, opacity 0.08s",
            }}
          >
            {canDrag && (
              <div
                onTouchStart={() => handleTouchStart(i)}
                style={{
                  color:"#3a5a8c", fontSize:20, userSelect:"none",
                  flexShrink:0, touchAction:"none", cursor:"grab",
                  padding:"4px 6px 10px 2px",
                }}>
                ⠿
              </div>
            )}
            <div style={{ flex:1 }}>
              <GameRow game={g} onUpdate={(f,v) => upd(i,f,v)} locked={locked} />
            </div>
          </div>
        ))}
        <p className="uppercase tracking-widest mb-2 mt-5" style={{ fontSize:9, color:"#3a5a8c", fontWeight:700 }}>Standings</p>
        <StandingsTable teams={teams} games={games} cutAt={cutAt} topTag={topTag} botTag={botTag} prevGames={prevGames} swaps={swaps} onSwap={onSwap} locked={locked} />
        <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:4 }}>
          <p style={{ fontSize:10, color:"#3a5a8c" }}>
            <strong style={{ color:"#4a6a9c" }}>Points:</strong> Win 3 · OT/SO Win 2 · OT/SO Loss 1 · SO Draw 1 · Loss 0
          </p>
          <p style={{ fontSize:10, color:"#3a5a8c" }}>
            <strong style={{ color:"#4a6a9c" }}>Tiebreaker:</strong> Points → Head-to-head → Goal difference → Goals scored → Fewest penalty minutes
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Playoff Panel ────────────────────────────────────────────
function PlayoffPanel({ title, accent, data, onDataChange, locked }) {
  const upd = (i, f, v) => {
    const games = refreshFinals(data.games.map((g, j) => j===i ? {...g,[f]:v} : g));
    onDataChange({ ...data, games });
  };
  const { games } = data;
  const gold   = games[3];
  const bronze = games[2];
  const finished = played(gold) && played(bronze);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background:"#0d1b2e", border:"1px solid rgba(255,255,255,0.07)" }}>
      <div className="px-4 py-3" style={{ background: accent }}>
        <span className="font-bold text-white" style={{ fontSize:15 }}>{title}</span>
      </div>
      <div className="p-4">
        {games.map((g, i) => (
          <div key={g.id} className="mb-4">
            <p className="uppercase tracking-widest mb-1.5"
              style={{ fontSize:9, color: i >= 2 ? "#f59e0b" : "#3a5a8c", fontWeight:700 }}>
              {g.label}
            </p>
            <GameRow game={g} onUpdate={(f,v) => upd(i,f,v)} isPlayoff={i < 2} locked={locked} />
          </div>
        ))}
        {finished && (
          <div className="rounded-xl p-4 mt-2 space-y-2" style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)" }}>
            <div className="flex items-center gap-2">
              <span style={{fontSize:18}}>🥇</span>
              <span className="font-bold" style={{color:"#fcd34d",fontSize:13}}>{winner(gold)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{fontSize:18}}>🥈</span>
              <span className="font-semibold" style={{color:"#cbd5e1",fontSize:13}}>{loser(gold)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{fontSize:18}}>🥉</span>
              <span className="font-semibold" style={{color:"#cd7c3a",fontSize:13}}>{winner(bronze)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{fontSize:18, opacity:0.4}}>4</span>
              <span style={{color:"#4a5a7c",fontSize:13}}>{loser(bronze)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Playoff Projection Panel (shows seedings + times, no score entry) ─
function PlayoffProjectionPanel({ title, accent, teams, times }) {
  const [s1, s2, s3, s4] = teams;
  const [t1, t2, tb, tg] = times || [];
  const matchups = [
    { label:"Semi-Final 1", time:t1, a: s1, b: s4 },
    { label:"Semi-Final 2", time:t2, a: s2, b: s3 },
    { label:"Bronze Medal", time:tb, a: "TBD", b: "TBD" },
    { label:"Gold Medal",   time:tg, a: "TBD", b: "TBD" },
  ];
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background:"#0d1b2e", border:"1px solid rgba(251,191,36,0.15)" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: accent, opacity:0.85 }}>
        <span className="font-bold text-white" style={{ fontSize:14 }}>{title}</span>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.7)", fontWeight:600, letterSpacing:"0.08em" }}>PROJECTED</span>
      </div>
      <div className="p-4 space-y-3">
        {matchups.map((m, i) => (
          <div key={m.label}>
            <p className="uppercase tracking-widest mb-1.5" style={{ fontSize:9, color: i >= 2 ? "#f59e0b" : "#3a5a8c", fontWeight:700 }}>{m.label}</p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }}>
              {m.time && <span style={{ fontSize:10, fontWeight:700, color:"#3a5a8c", fontFamily:"'DM Mono',monospace", minWidth:34, flexShrink:0 }}>{m.time}</span>}
              <span style={{ flex:1, textAlign:"right", fontSize:12, fontWeight:600, color: i < 2 ? "#c8d8f0" : "#4a5a7c" }}>{m.a || "TBD"}</span>
              <span style={{ fontSize:10, color:"#3a5a8c", fontWeight:700, padding:"0 8px" }}>vs</span>
              <span style={{ flex:1, fontSize:12, fontWeight:600, color: i < 2 ? "#c8d8f0" : "#4a5a7c" }}>{m.b || "TBD"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────
const PHASES  = ["day1","day2","day3"];
const PLABELS = ["Day 1 · Friday","Day 2 · Saturday","Day 3 · Playoffs"];

export default function HockeyTournament() {
  const [phase, setPhase] = useState("day1");

  const [g1, setG1] = useState(DAY1_G1);
  const [g2, setG2] = useState(DAY1_G2);
  const [gA, setGA] = useState({ teams:[], games:[] });
  const [gB, setGB] = useState({ teams:[], games:[] });
  const [pA, setPA] = useState({ teams:[], games:[] });
  const [pB, setPB] = useState({ teams:[], games:[] });
  const [pC, setPC] = useState({ teams:[], games:[] });

  // Day 2 schedule order — permutation of [0..8] mapping slot → original matchup index
  const [day2OrderA, setDay2OrderA] = useState([0,1,2,3,4,5,6,7,8]);
  const [day2OrderB, setDay2OrderB] = useState([0,1,2,3,4,5,6,7,8]);

  // Coin-flip manual overrides for completely tied teams (per group)
  const [swaps1, setSwaps1] = useState({});
  const [swaps2, setSwaps2] = useState({});
  const [swapsA, setSwapsA] = useState({});
  const [swapsB, setSwapsB] = useState({});
  const makeSwapHandler = (setter) => (key, winner) =>
    setter(prev => ({ ...prev, [key]: winner }));

  // ── Auth state ──────────────────────────────────────────────
  const [locked, setLocked]       = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [pwInput, setPwInput]     = useState("");
  const [pwError, setPwError]     = useState(false);

  const tryUnlock = () => {
    if (pwInput === PASSWORD) {
      setLocked(false); setShowModal(false); setPwInput(""); setPwError(false);
    } else {
      setPwError(true); setPwInput("");
    }
  };

  // ── Reset state ──────────────────────────────────────────────
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetInput, setResetInput]         = useState("");

  const clearGame = g => ({ ...g, s1:"", s2:"", ot:false, soResult:null, pim1:0, pim2:0 });
  const clearPlayoffGame = (g, i) =>
    i >= 2 ? { ...g, s1:"", s2:"", ot:false, soResult:null, team1:null, team2:null } : clearGame(g);

  const clearAllScores = () => {
    setG1({ ...DAY1_G1, games: DAY1_G1.games.map(clearGame) });
    setG2({ ...DAY1_G2, games: DAY1_G2.games.map(clearGame) });
    [setGA, setGB].forEach(set => set(p => ({ ...p, games: p.games.map(clearGame) })));
    [setPA, setPB, setPC].forEach(set => set(p => ({ ...p, games: p.games.map(clearPlayoffGame) })));
    setSwaps1({}); setSwaps2({}); setSwapsA({}); setSwapsB({});
    setShowResetModal(false);
    setResetInput("");
  };

  // ── Persistence (Firebase Realtime Database) ─────────────────
  const [initialized, setInitialized] = useState(false);
  const suppressUpdate = useRef(false); // prevents echo from our own writes

  // Helper: build Day 2 games from a permutation order
  const buildDay2GamesFromOrder = (teams, sched, order, pfx) => {
    const times = sched.map(([,,t]) => t);
    return order.map((schedIdx, slotIdx) => {
      const [i, j] = sched[schedIdx];
      return { id:`${pfx}${schedIdx}`, time:times[slotIdx], team1:teams[i], team2:teams[j], s1:"", s2:"", soResult:null, pim1:0, pim2:0 };
    });
  };

  // Recover order permutation from a reordered games array (IDs encode original schedIdx)
  const recoverOrder = (newGames, pfx) =>
    newGames.map(g => parseInt(g.id.replace(pfx, '')));

  // Subscribe to Firebase on mount — fires immediately with current data, then on every remote change
  useEffect(() => {
    const tournamentRef = ref(db, 'tournament');
    const unsub = onValue(tournamentRef, (snapshot) => {
      // Skip updates that we triggered ourselves (prevents write → listen → write loop)
      if (suppressUpdate.current) {
        suppressUpdate.current = false;
        setInitialized(true);
        return;
      }
      const s = snapshot.val();
      if (s) {
        if (s.g1)         setG1(s.g1);
        if (s.g2)         setG2(s.g2);
        if (s.gA)         setGA(s.gA);
        if (s.gB)         setGB(s.gB);
        if (s.pA)         setPA(s.pA);
        if (s.pB)         setPB(s.pB);
        if (s.pC)         setPC(s.pC);
        if (s.day2OrderA) setDay2OrderA(s.day2OrderA);
        if (s.day2OrderB) setDay2OrderB(s.day2OrderB);
        if (s.swaps1)     setSwaps1(s.swaps1);
        if (s.swaps2)     setSwaps2(s.swaps2);
        if (s.swapsA)     setSwapsA(s.swapsA);
        if (s.swapsB)     setSwapsB(s.swapsB);
      }
      setInitialized(true);
    });
    return unsub; // cleanup listener on unmount
  }, []);

  // Save to Firebase whenever state changes (after first load) — debounced 800ms
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!initialized) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      suppressUpdate.current = true;
      set(ref(db, 'tournament'), {
        g1, g2, gA, gB, pA, pB, pC, day2OrderA, day2OrderB,
        swaps1, swaps2, swapsA, swapsB
      }).catch(console.error);
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [phase, g1, g2, gA, gB, pA, pB, pC, day2OrderA, day2OrderB, swaps1, swaps2, swapsA, swapsB]); // eslint-disable-line

  // ── Phase helpers ────────────────────────────────────────────
  const phaseEnabled = {
    day1: true,
    day2: true,
    day3: true,
  };

  const goDay2 = () => {
    const [s1, s2] = [
      calcStandings(g1.teams, g1.games, [], swaps1),
      calcStandings(g2.teams, g2.games, [], swaps2),
    ];
    const tA = [...s1.slice(0,3), ...s2.slice(0,3)].map(s => s.team);
    const tB = [...s1.slice(3),   ...s2.slice(3)  ].map(s => s.team);
    setGA({ teams:tA, games:buildDay2GamesFromOrder(tA, DAY2_GRUPP_A_SCHED, day2OrderA, "gA_") });
    setGB({ teams:tB, games:buildDay2GamesFromOrder(tB, DAY2_GRUPP_B_SCHED, day2OrderB, "gB_") });
    setPhase("day2");
  };

  const goDay3 = () => {
    const d1Games = [...g1.games, ...g2.games];
    const [sA, sB] = [
      calcStandings(gA.teams, gA.games, d1Games, swapsA),
      calcStandings(gB.teams, gB.games, d1Games, swapsB),
    ];
    const tA = sA.slice(0,4).map(s => s.team);
    const tB = [...sA.slice(4), ...sB.slice(0,2)].map(s => s.team);
    const tC = sB.slice(2).map(s => s.team);
    setPA({ teams:tA, games:makePlayoffGames(tA, "pA_", ["10:10","11:05","15:05","16:00"]) });
    setPB({ teams:tB, games:makePlayoffGames(tB, "pB_", ["08:35","09:30","13:30","14:25"]) });
    setPC({ teams:tC, games:makePlayoffGames(tC, "pC_", ["07:00","07:55","11:45","12:40"]) });
    setPhase("day3");
  };

  const allPlayed  = (...arrs) => arrs.every(a => a.length > 0 && a.every(played));
  const countPlayed = (...arrs) => arrs.flat().filter(played).length;
  const d1Ready = allPlayed(g1.games, g2.games);
  const d2Ready = allPlayed(gA.games, gB.games);
  const phaseIdx = PHASES.indexOf(phase);

  if (!initialized) return (
    <div style={{
      minHeight:"100vh", background:"#070f1c",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'DM Sans', sans-serif", color:"#4a6a9c", fontSize:14,
    }}>
      🏒 Loading tournament…
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#070f1c", fontFamily:"'DM Sans', sans-serif", color:"#c8d8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono&display=swap');
        * { box-sizing: border-box; }
        .score-input {
          width: 40px; height: 34px;
          text-align: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          color: #e8f0ff;
          font-size: 15px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          outline: none;
          -moz-appearance: textfield;
        }
        .score-input::-webkit-outer-spin-button,
        .score-input::-webkit-inner-spin-button { -webkit-appearance: none; }
        .score-input:focus { border-color: rgba(100,160,255,0.5); background: rgba(100,160,255,0.08); }
        .score-input:disabled { opacity: 0.45; cursor: not-allowed; }
        .advance-btn {
          width: 100%; padding: 14px;
          border-radius: 14px; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 700;
          transition: all 0.15s;
        }
        .advance-btn:disabled { background: rgba(255,255,255,0.05); color: #3a4a6a; cursor: not-allowed; }
        .advance-btn:not(:disabled) { background: linear-gradient(135deg,#1d6aff,#0a4adf); color: white; }
        .advance-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(29,106,255,0.3); }
        .team-input {
          width: 100%; padding: 9px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          color: #c8d8f0; font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          outline: none; margin-bottom: 8px;
        }
        .team-input:focus { border-color: rgba(100,160,255,0.4); background: rgba(100,160,255,0.06); }
        .team-input:disabled { opacity: 0.45; cursor: not-allowed; }
        .phase-pill {
          padding: 6px 16px; border-radius: 99px;
          font-size: 12px; font-weight: 600;
          transition: all 0.15s;
          border: none; font-family: 'DM Sans', sans-serif;
        }
        .phase-pill:not(:disabled):hover { filter: brightness(1.15); }
        .pw-input {
          width: 100%; padding: 11px 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          color: #e8f0ff; font-size: 15px;
          font-family: 'DM Mono', monospace;
          outline: none; letter-spacing: 0.1em;
        }
        .pw-input:focus { border-color: rgba(100,160,255,0.5); background: rgba(100,160,255,0.08); }
        .pw-input.error { border-color: rgba(248,113,113,0.6); background: rgba(248,113,113,0.05); }
      `}</style>

      {/* ── Reset Scores Modal ─────────────────────────────── */}
      {showResetModal && (
        <div style={{
          position:"fixed", inset:0, zIndex:50,
          background:"rgba(0,0,0,0.8)", backdropFilter:"blur(6px)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:24,
        }}
          onClick={e => { if (e.target === e.currentTarget) { setShowResetModal(false); setResetInput(""); } }}>
          <div style={{
            background:"#0d1b2e", border:"1px solid rgba(248,113,113,0.25)",
            borderRadius:20, padding:32, width:"100%", maxWidth:380,
          }}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>⚠️</div>
              <h2 style={{ fontWeight:800, fontSize:18, color:"#fca5a5", margin:0 }}>Clear All Scores</h2>
              <p style={{ fontSize:13, color:"#6a8abc", marginTop:8, lineHeight:1.6 }}>
                This will erase every score across all days and playoffs.<br/>
                <strong style={{ color:"#c8d8f0" }}>Team names are kept.</strong> This cannot be undone.
              </p>
            </div>
            <p style={{ fontSize:12, color:"#4a6a9c", marginBottom:8, textAlign:"center" }}>
              Enter the reset password to confirm
            </p>
            <input
              className={`pw-input${pwError ? " error" : ""}`}
              type="password"
              placeholder="Password"
              value={resetInput}
              autoFocus
              onChange={e => { setResetInput(e.target.value); }}
              onKeyDown={e => e.key === "Enter" && resetInput === RESET_PASSWORD && clearAllScores()}
            />
            {resetInput.length > 0 && resetInput !== RESET_PASSWORD && (
              <p style={{ color:"#f87171", fontSize:12, marginTop:8, textAlign:"center" }}>
                Incorrect password
              </p>
            )}
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={() => { setShowResetModal(false); setResetInput(""); }}
                style={{
                  flex:1, padding:"11px 0", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)",
                  background:"transparent", color:"#6a8abc", fontSize:14, fontWeight:600,
                  cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
                }}>Cancel</button>
              <button onClick={clearAllScores}
                disabled={resetInput !== RESET_PASSWORD}
                style={{
                  flex:2, padding:"11px 0", borderRadius:10, border:"none",
                  background: resetInput === RESET_PASSWORD
                    ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "rgba(255,255,255,0.05)",
                  color: resetInput === RESET_PASSWORD ? "white" : "#3a4a6a",
                  fontSize:14, fontWeight:700,
                  cursor: resetInput === RESET_PASSWORD ? "pointer" : "not-allowed",
                  fontFamily:"'DM Sans', sans-serif", transition:"all 0.15s",
                }}>Clear All Scores</button>
            </div>
          </div>
        </div>
      )}


      {showModal && (
        <div style={{
          position:"fixed", inset:0, zIndex:50,
          background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:24,
        }}
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setPwInput(""); setPwError(false); } }}>
          <div style={{
            background:"#0d1b2e", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:20, padding:32, width:"100%", maxWidth:360,
          }}>
            <div style={{ textAlign:"center", marginBottom:24 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🔐</div>
              <h2 style={{ fontWeight:800, fontSize:18, color:"#e8f4ff", margin:0 }}>Admin Access</h2>
              <p style={{ fontSize:13, color:"#4a6a9c", marginTop:6 }}>Enter the password to edit scores</p>
            </div>
            <input
              className={`pw-input${pwError ? " error" : ""}`}
              type="password"
              placeholder="Password"
              value={pwInput}
              autoFocus
              onChange={e => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={e => e.key === "Enter" && tryUnlock()}
            />
            {pwError && (
              <p style={{ color:"#f87171", fontSize:12, marginTop:8, textAlign:"center" }}>
                Incorrect password — try again
              </p>
            )}
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={() => { setShowModal(false); setPwInput(""); setPwError(false); }}
                style={{
                  flex:1, padding:"11px 0", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)",
                  background:"transparent", color:"#6a8abc", fontSize:14, fontWeight:600,
                  cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
                }}>Cancel</button>
              <button onClick={tryUnlock}
                style={{
                  flex:2, padding:"11px 0", borderRadius:10, border:"none",
                  background:"linear-gradient(135deg,#1d6aff,#0a4adf)", color:"white",
                  fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
                }}>Unlock</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 16px" }}>

        {/* Header */}
        <div className="text-center" style={{ marginBottom:32 }}>
          <div style={{ fontSize:13, letterSpacing:"0.2em", color:"#3a5a8c", fontWeight:600, marginBottom:8 }}>
            🏒 TOURNAMENT MANAGER
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:16 }}>
            <h1 style={{ fontSize:28, fontWeight:800, color:"#e8f4ff", margin:0, letterSpacing:"-0.5px" }}>
              Ice Hockey Tournament
            </h1>
            {/* Lock / Unlock button */}
            {locked
              ? <button onClick={() => setShowModal(true)}
                  title="Unlock to edit scores"
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"6px 14px", borderRadius:99, border:"1px solid rgba(255,255,255,0.12)",
                    background:"rgba(255,255,255,0.05)", color:"#6a8abc",
                    fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
                    transition:"all 0.15s",
                  }}>
                  🔒 Locked
                </button>
              : <button onClick={() => setLocked(true)}
                  title="Lock score editing"
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"6px 14px", borderRadius:99, border:"1px solid rgba(52,211,153,0.3)",
                    background:"rgba(52,211,153,0.1)", color:"#34d399",
                    fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
                    transition:"all 0.15s",
                  }}>
                  🔓 Unlocked
                </button>
            }
            {/* Clear scores button — only shown when unlocked */}
            {!locked && (
              <button onClick={() => setShowResetModal(true)}
                title="Clear all scores"
                style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"6px 14px", borderRadius:99, border:"1px solid rgba(248,113,113,0.2)",
                  background:"rgba(248,113,113,0.06)", color:"#f87171",
                  fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans', sans-serif",
                  transition:"all 0.15s",
                }}>
                🗑 Clear Scores
              </button>
            )}
          </div>
          {/* Clickable phase navigation */}
          <div className="flex justify-center gap-2 flex-wrap">
            {PHASES.map((p, i) => {
              const active  = i === phaseIdx;
              const visited = i < phaseIdx;
              const enabled = phaseEnabled[p];
              return (
                <button key={p} className="phase-pill"
                  disabled={!enabled}
                  onClick={() => enabled && setPhase(p)}
                  style={{
                    background: active  ? "rgba(29,106,255,0.9)" :
                                visited ? "rgba(29,106,255,0.12)" :
                                enabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                    color:  active  ? "#fff" :
                            visited ? "#6090ff" :
                            enabled ? "#8aaad8" : "#2a3a5c",
                    cursor: enabled ? "pointer" : "not-allowed",
                  }}>
                  {PLABELS[i]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── DAY 1 ── */}
        {phase === "day1" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:20, marginBottom:20 }}>
              <GroupPanel title="Friday · Group 1" accent="linear-gradient(135deg,#1d4ed8,#3b82f6)"
                teams={g1.teams} games={g1.games}
                onGamesChange={games => setG1(p => ({...p,games}))}
                cutAt={3} topTag="→ Grp A" botTag="→ Grp B" locked={locked}
                swaps={swaps1} onSwap={makeSwapHandler(setSwaps1)} />
              <GroupPanel title="Friday · Group 2" accent="linear-gradient(135deg,#6d28d9,#8b5cf6)"
                teams={g2.teams} games={g2.games}
                onGamesChange={games => setG2(p => ({...p,games}))}
                cutAt={3} topTag="→ Grp A" botTag="→ Grp B" locked={locked}
                swaps={swaps2} onSwap={makeSwapHandler(setSwaps2)} />
            </div>
            <button className="advance-btn" onClick={goDay2} disabled={!d1Ready || locked}>
              {locked ? "🔒 Unlock to advance" : d1Ready ? "Advance to Day 2 →" : `${countPlayed(g1.games, g2.games)}/18 games played — enter all results to advance`}
            </button>
          </div>
        )}

        {/* ── DAY 2 ── */}
        {phase === "day2" && (() => {
          const s1 = calcStandings(g1.teams, g1.games);
          const s2 = calcStandings(g2.teams, g2.games);
          // projA = [M1,M2,M3, A1,A2,A3], projB = [M4,M5,M6, A4,A5,A6]
          const projA = [...s1.slice(0,3), ...s2.slice(0,3)].map(s => s.team);
          const projB = [...s1.slice(3),   ...s2.slice(3)  ].map(s => s.team);
          const isProjection = gA.teams.length === 0;

          return (
            <div>
              <div className="rounded-xl" style={{
                background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
                padding:"12px 18px", marginBottom:20, fontSize:13, color:"#8aaad8", lineHeight:1.7
              }}>
                <strong style={{color:"#c8d8f0"}}>📋 Note:</strong> The first three games in Group B may be reordered to accommodate results from the late Friday games, ensuring well-rested players meet each other where possible.
              </div>
              <div className="rounded-xl" style={{
                background:"rgba(100,160,255,0.05)", border:"1px solid rgba(100,160,255,0.1)",
                padding:"12px 18px", marginBottom:20, fontSize:13, color:"#8aaad8", lineHeight:1.7
              }}>
                <strong style={{color:"#c8d8f0"}}>Day 3 Placement: </strong>
                <span style={{color:"#34d399"}}>Top 4 Group A → Playoff A</span>
                {" · "}
                <span style={{color:"#fbbf24"}}>Bottom 2 Group A + Top 2 Group B → Playoff B</span>
                {" · "}
                <span style={{color:"#f87171"}}>Bottom 4 Group B → Playoff C</span>
              </div>

              {isProjection && (
                <div className="rounded-xl" style={{
                  background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.2)",
                  padding:"10px 16px", marginBottom:20, fontSize:12, color:"#fbbf24",
                  display:"flex", alignItems:"center", gap:8,
                }}>
                  <span>⏳</span>
                  <span><strong>Live projection</strong> — based on current Day 1 standings. Advance from Day 1 to lock in groups.</span>
                </div>
              )}

              {/* Group B shown first — plays in the morning */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:20, marginBottom:20 }}>
                {isProjection ? (
                  <>
                    <GroupPanel title="Saturday · Group B (projected)" accent="linear-gradient(135deg,#7f1d1d,#b91c1c)"
                      teams={projB}
                      games={buildDay2GamesFromOrder(projB, DAY2_GRUPP_B_SCHED, day2OrderB, "projB_")}
                      onGamesChange={newGames => setDay2OrderB(recoverOrder(newGames, "projB_"))}
                      cutAt={2} topTag="Ply B" botTag="Ply C"
                      locked={true} reorderable={!locked} prevGames={[...g1.games, ...g2.games]}
                      swaps={swapsB} onSwap={makeSwapHandler(setSwapsB)} />
                    <GroupPanel title="Saturday · Group A (projected)" accent="linear-gradient(135deg,#78350f,#d97706)"
                      teams={projA}
                      games={buildDay2GamesFromOrder(projA, DAY2_GRUPP_A_SCHED, day2OrderA, "projA_")}
                      onGamesChange={newGames => setDay2OrderA(recoverOrder(newGames, "projA_"))}
                      cutAt={4} topTag="Ply A" botTag="Ply B"
                      locked={true} reorderable={!locked} prevGames={[...g1.games, ...g2.games]}
                      swaps={swapsA} onSwap={makeSwapHandler(setSwapsA)} />
                  </>
                ) : (
                  <>
                    <GroupPanel title="Saturday · Group B" accent="linear-gradient(135deg,#7f1d1d,#b91c1c)"
                      teams={gB.teams} games={gB.games}
                      onGamesChange={games => setGB(p => ({...p,games}))}
                      cutAt={2} topTag="Ply B" botTag="Ply C" locked={locked} reorderable={!locked}
                      prevGames={[...g1.games, ...g2.games]}
                      swaps={swapsB} onSwap={makeSwapHandler(setSwapsB)} />
                    <GroupPanel title="Saturday · Group A" accent="linear-gradient(135deg,#78350f,#d97706)"
                      teams={gA.teams} games={gA.games}
                      onGamesChange={games => setGA(p => ({...p,games}))}
                      cutAt={4} topTag="Ply A" botTag="Ply B" locked={locked} reorderable={!locked}
                      prevGames={[...g1.games, ...g2.games]}
                      swaps={swapsA} onSwap={makeSwapHandler(setSwapsA)} />
                  </>
                )}
              </div>

              {!isProjection && (
                <button className="advance-btn" onClick={goDay3} disabled={!d2Ready || locked}>
                  {locked ? "🔒 Unlock to advance" : d2Ready ? "Advance to Day 3 Playoffs →" : `${countPlayed(gA.games, gB.games)}/18 games played — enter all results to advance`}
                </button>
              )}
            </div>
          );
        })()}

        {/* ── DAY 3 PLAYOFFS ── */}
        {phase === "day3" && (() => {
          const isProjection = pA.teams.length === 0;

          // Compute projected playoff seeds from whatever data exists
          const s1 = calcStandings(g1.teams, g1.games);
          const s2 = calcStandings(g2.teams, g2.games);
          const projA_teams = gA.teams.length > 0 ? gA.teams : [...s1.slice(0,3), ...s2.slice(0,3)].map(s => s.team);
          const projB_teams = gB.teams.length > 0 ? gB.teams : [...s1.slice(3),   ...s2.slice(3)  ].map(s => s.team);
          const projA_games = gA.games.length > 0 ? gA.games : [];
          const projB_games = gB.games.length > 0 ? gB.games : [];
          const d1Games    = [...g1.games, ...g2.games];
          const sA = calcStandings(projA_teams, projA_games, d1Games, swapsA);
          const sB = calcStandings(projB_teams, projB_games, d1Games, swapsB);
          const projPA = sA.slice(0,4).map(s => s.team);
          const projPB = [...sA.slice(4), ...sB.slice(0,2)].map(s => s.team);
          const projPC = sB.slice(2).map(s => s.team);

          const allDone = !isProjection &&
            played(pA.games[3]) && played(pA.games[2]) &&
            played(pB.games[3]) && played(pB.games[2]) &&
            played(pC.games[3]) && played(pC.games[2]);

          return (
            <div>
              {isProjection && (
                <div className="rounded-xl" style={{
                  background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.2)",
                  padding:"10px 16px", marginBottom:20, fontSize:12, color:"#fbbf24",
                  display:"flex", alignItems:"center", gap:8,
                }}>
                  <span>⏳</span>
                  <span><strong>Live projection</strong> — seedings update as scores come in. Advance through Day 2 to lock in brackets.</span>
                </div>
              )}

              {/* Panels ordered C → B → A, matching ice time */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20, marginBottom:20 }}>
                {isProjection ? (
                  <>
                    <PlayoffProjectionPanel title="🎖 Playoff C — Sunday 07:00"
                      accent="linear-gradient(135deg,#7c2d12,#c2410c)" teams={projPC}
                      times={["07:00","07:55","11:45","12:40"]} />
                    <PlayoffProjectionPanel title="🥈 Playoff B — Sunday 08:35"
                      accent="linear-gradient(135deg,#374151,#6b7280)" teams={projPB}
                      times={["08:35","09:30","13:30","14:25"]} />
                    <PlayoffProjectionPanel title="🏆 Playoff A — Sunday 10:10"
                      accent="linear-gradient(135deg,#b45309,#d97706)" teams={projPA}
                      times={["10:10","11:05","15:05","16:00"]} />
                  </>
                ) : (
                  <>
                    <PlayoffPanel title="🎖 Playoff C — Sunday 07:00"
                      accent="linear-gradient(135deg,#7c2d12,#c2410c)"
                      data={pC} onDataChange={setPC} locked={locked} />
                    <PlayoffPanel title="🥈 Playoff B — Sunday 08:35"
                      accent="linear-gradient(135deg,#374151,#6b7280)"
                      data={pB} onDataChange={setPB} locked={locked} />
                    <PlayoffPanel title="🏆 Playoff A — Sunday 10:10"
                      accent="linear-gradient(135deg,#b45309,#d97706)"
                      data={pA} onDataChange={setPA} locked={locked} />
                  </>
                )}
              </div>

              {/* Medal ceremony banner */}
              {allDone && (
                <div className="rounded-2xl" style={{
                  background:"linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,179,8,0.08))",
                  border:"1px solid rgba(245,158,11,0.3)",
                  padding:"20px 28px", textAlign:"center",
                }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🏅</div>
                  <div style={{ fontWeight:800, fontSize:18, color:"#fcd34d", marginBottom:4 }}>Tournament Complete</div>
                  <div style={{ fontSize:14, color:"#d97706", fontWeight:600 }}>Medal Ceremony — 16:40</div>
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
