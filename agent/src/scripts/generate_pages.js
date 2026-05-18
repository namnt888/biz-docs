"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
var SUPABASE_URL = process.env.SUPABASE_URL || "https://fyrgmsfsqzofqduiidrj.supabase.co";
var SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmdtc2ZzcXpvZnFkdWlpZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTcxNDQsImV4cCI6MjA5NDUzMzE0NH0.V15TiTEf0JYYgi42enkGbTNHV0XpHPLPmw3F23G4Bwc";
var headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': "Bearer ".concat(SUPABASE_ANON_KEY)
};
var vaultPath = path_1.default.resolve(__dirname, '../../../vault');
var accountsDir = path_1.default.join(vaultPath, '02_Accounts');
var peopleDir = path_1.default.join(vaultPath, '03_People');
if (!fs_1.default.existsSync(accountsDir))
    fs_1.default.mkdirSync(accountsDir, { recursive: true });
if (!fs_1.default.existsSync(peopleDir))
    fs_1.default.mkdirSync(peopleDir, { recursive: true });
// ──────────────────────────────────────────────
// ACCOUNT PAGE TEMPLATE
// ──────────────────────────────────────────────
function accountPage(acc) {
    return "---\ntype: account\nid: ".concat(acc.id, "\n---\n# \uD83D\uDCB3 ").concat(acc.name, "\n\n[\uD83D\uDC48 Tr\u1EDF v\u1EC1 Dashboard](../00_Dashboard/Dashboard.md)\n\n## \uD83D\uDCCA Th\u1ED1ng k\u00EA T\u00E0i kho\u1EA3n\n\n```dataviewjs\nconst SUPABASE_URL = \"").concat(SUPABASE_URL, "\";\nconst SUPABASE_ANON_KEY = \"").concat(SUPABASE_ANON_KEY, "\";\nconst headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };\n\nconst accId = dv.current().id;\n\nconst [accRes, txnRes] = await Promise.all([\n  fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${accId}`, { headers }),\n  fetch(`${SUPABASE_URL}/rest/v1/transactions?account_id=eq.${accId}&status=eq.posted`, { headers })\n]);\n\nif (accRes.ok && txnRes.ok) {\n  const accData = await accRes.json();\n  const txns = await txnRes.json();\n  const balance = accData[0]?.current_balance || 0;\n  const now = new Date();\n  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();\n  let totalIn = 0, totalOut = 0, monthIn = 0, monthOut = 0;\n  txns.forEach(t => {\n    const amt = Number(t.amount);\n    const isPlus = ['income', 'repayment', 'refund', 'transfer_in'].includes(t.type);\n    const isThisMonth = t.occurred_at >= startOfMonth;\n    if (isPlus) { totalIn += amt; if (isThisMonth) monthIn += amt; }\n    else { totalOut += amt; if (isThisMonth) monthOut += amt; }\n  });\n  dv.table([\"Ch\u1EC9 s\u1ED1\", \"Gi\u00E1 tr\u1ECB\"], [\n    [\"\uD83D\uDCB0 S\u1ED1 d\u01B0 hi\u1EC7n t\u1EA1i\", `**${Number(balance).toLocaleString()} VND**`],\n    [\"\uD83D\uDFE2 T\u1ED5ng Thu (All time)\", `${totalIn.toLocaleString()} VND`],\n    [\"\uD83D\uDD34 T\u1ED5ng Chi (All time)\", `${totalOut.toLocaleString()} VND`],\n    [\"\uD83D\uDCC8 Thu th\u00E1ng n\u00E0y\", `${monthIn.toLocaleString()} VND`],\n    [\"\uD83D\uDCC9 Chi th\u00E1ng n\u00E0y\", `${monthOut.toLocaleString()} VND`]\n  ]);\n} else {\n  dv.paragraph(\"\u274C L\u1ED7i t\u1EA3i d\u1EEF li\u1EC7u\");\n}\n```\n\n## \uD83C\uDF81 Ho\u00E0n ti\u1EC1n (Cashback Cycles)\n\n```dataviewjs\nconst SUPABASE_URL = \"").concat(SUPABASE_URL, "\";\nconst SUPABASE_ANON_KEY = \"").concat(SUPABASE_ANON_KEY, "\";\nconst headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };\n\nconst accId = dv.current().id;\nconst res = await fetch(`${SUPABASE_URL}/rest/v1/cashback_cycles?account_id=eq.${accId}&order=cycle_tag.desc`, { headers });\n\nif (res.ok) {\n  const cycles = await res.json();\n  if (cycles.length > 0) {\n    dv.table([\"K\u1EF3 sao k\u00EA\", \"\u0110\u00E3 chi ti\u00EAu\", \"CB D\u1EF1 ki\u1EBFn\", \"CB Th\u1EF1c t\u1EBF\"], cycles.map(c => [\n      `**${c.cycle_tag}**`,\n      `${Number(c.spent_amount).toLocaleString()} VND`,\n      `${Number(c.virtual_profit).toLocaleString()} VND`,\n      `**${Number(c.real_awarded).toLocaleString()} VND**`\n    ]));\n  } else {\n    dv.paragraph(\"Kh\u00F4ng c\u00F3 d\u1EEF li\u1EC7u ho\u00E0n ti\u1EC1n.\");\n  }\n}\n```\n\n## \uD83D\uDCDC L\u1ECBch s\u1EED Giao d\u1ECBch (20 g\u1EA7n nh\u1EA5t)\n\n```dataviewjs\nconst SUPABASE_URL = \"").concat(SUPABASE_URL, "\";\nconst SUPABASE_ANON_KEY = \"").concat(SUPABASE_ANON_KEY, "\";\nconst headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };\n\nconst accId = dv.current().id;\nconst res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?account_id=eq.${accId}&order=occurred_at.desc&limit=20`, { headers });\n\nif (res.ok) {\n  const txns = await res.json();\n  dv.table([\"ID\", \"Th\u00E1ng\", \"Ng\u00E0y\", \"Lo\u1EA1i\", \"S\u1ED1 ti\u1EC1n\", \"% CB\", \"CB C\u1ED1 \u0111\u1ECBnh\", \"\u03A3 CB\", \"Final Price\", \"Ghi ch\u00FA\"], txns.map(t => {\n    const isPlus = ['income', 'repayment', 'refund', 'transfer_in'].includes(t.type);\n    const sign = isPlus ? \"\uD83D\uDFE2 +\" : \"\uD83D\uDD34 -\";\n    const d = new Date(t.occurred_at);\n    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;\n    const shortId = t.id ? t.id.substring(0, 5) : '-';\n    const amt = Number(t.amount);\n    const cbPct = Number(t.cashback_share_percent || 0);\n    const cbFixed = Number(t.cashback_share_fixed || 0);\n    const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;\n    const fee = Number(t.metadata?.service_fee || 0);\n    const net = amt - cbSum + fee;\n    return [\n      `\\`${shortId}\\``,\n      `[[${mStr}]]`,\n      d.toLocaleDateString('vi-VN'),\n      `${sign}${t.type}`,\n      `**${amt.toLocaleString()} \u0111**`,\n      cbPct > 0 ? `${(cbPct * 100).toFixed(1)}%` : '-',\n      cbFixed > 0 ? `${cbFixed.toLocaleString()} \u0111` : '-',\n      cbSum > 0 ? `${cbSum.toLocaleString()} \u0111` : '-',\n      `**${net.toLocaleString()} \u0111**`,\n      t.note || \"-\"\n    ];\n  }));\n}\n```\n");
}
// ──────────────────────────────────────────────
// PEOPLE PAGE TEMPLATE
// ──────────────────────────────────────────────
function peoplePage(p) {
    return "---\ntype: person\nid: ".concat(p.id, "\n---\n# \uD83D\uDC64 ").concat(p.name, "\n\n[\uD83D\uDC48 Tr\u1EDF v\u1EC1 Debt Center](../00_Dashboard/Debt_Center.md)\n\n## \uD83E\uDD1D T\u1ED5ng quan C\u00F4ng n\u1EE3\n\n```dataviewjs\nconst SUPABASE_URL = \"").concat(SUPABASE_URL, "\";\nconst SUPABASE_ANON_KEY = \"").concat(SUPABASE_ANON_KEY, "\";\nconst headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };\n\nconst personId = dv.current().id;\nconst res = await fetch(`${SUPABASE_URL}/rest/v1/debts?person_id=eq.${personId}&order=occurred_at.desc`, { headers });\n\nif (res.ok) {\n  const debts = await res.json();\n  if (debts.length > 0) {\n    // Summary row\n    const totalOrig = debts.reduce((s, d) => s + Number(d.original_amount), 0);\n    const totalRepaid = debts.reduce((s, d) => s + Number(d.repaid_amount), 0);\n    const totalRemain = debts.reduce((s, d) => s + Number(d.remaining_amount), 0);\n    dv.paragraph(`\uD83D\uDCCA **T\u1ED5ng n\u1EE3:** ${totalOrig.toLocaleString()} \u0111 &nbsp;|&nbsp; **\u0110\u00E3 tr\u1EA3:** ${totalRepaid.toLocaleString()} \u0111 &nbsp;|&nbsp; **C\u00F2n l\u1EA1i:** ${totalRemain.toLocaleString()} \u0111`);\n\n    dv.table([\"K\u1EF3 (Cycle)\", \"Lo\u1EA1i\", \"Ghi ch\u00FA\", \"T\u1ED5ng n\u1EE3\", \"\u0110\u00E3 tr\u1EA3\", \"C\u00F2n l\u1EA1i\", \"Tr\u1EA1ng th\u00E1i\"], debts.map(d => {\n      const isLent = d.debt_role === 'lent';\n      const roleStr = isLent ? \"\uD83D\uDFE2 Cho vay\" : \"\uD83D\uDD34 \u0110i m\u01B0\u1EE3n\";\n      let statusStr = \"\u26AA Settled\";\n      if (d.status === 'pending') statusStr = \"\uD83D\uDD34 Pending\";\n      if (d.status === 'partial') statusStr = \"\uD83D\uDFE0 Partial\";\n      const dt = new Date(d.occurred_at);\n      const mStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;\n      return [\n        mStr,\n        roleStr,\n        d.notes || \"-\",\n        `${Number(d.original_amount).toLocaleString()} \u0111`,\n        `${Number(d.repaid_amount).toLocaleString()} \u0111`,\n        `**${Number(d.remaining_amount).toLocaleString()} \u0111**`,\n        statusStr\n      ];\n    }));\n  } else {\n    dv.paragraph(\"Kh\u00F4ng c\u00F3 c\u00F4ng n\u1EE3 n\u00E0o v\u1EDBi ng\u01B0\u1EDDi n\u00E0y. \u2705\");\n  }\n}\n```\n\n## \uD83D\uDCDC Giao d\u1ECBch li\u00EAn quan (theo th\u00E1ng)\n\n> [!info] B\u1EA5m v\u00E0o t\u1EEBng th\u00E1ng \u0111\u1EC3 m\u1EDF r\u1ED9ng danh s\u00E1ch giao d\u1ECBch\n\n```dataviewjs\nconst SUPABASE_URL = \"").concat(SUPABASE_URL, "\";\nconst SUPABASE_ANON_KEY = \"").concat(SUPABASE_ANON_KEY, "\";\nconst headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };\n\nconst personId = dv.current().id;\nconst res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?person_id=eq.${personId}&order=occurred_at.desc`, { headers });\n\nif (res.ok) {\n  const txns = await res.json();\n  if (txns.length === 0) {\n    dv.paragraph(\"Kh\u00F4ng c\u00F3 giao d\u1ECBch.\");\n  } else {\n    // Group by month\n    const byMonth = {};\n    txns.forEach(t => {\n      const d = new Date(t.occurred_at);\n      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;\n      if (!byMonth[mStr]) byMonth[mStr] = [];\n      byMonth[mStr].push(t);\n    });\n\n    for (const [month, monthTxns] of Object.entries(byMonth)) {\n      const monthArr = monthTxns;\n      const totalAmt = monthArr.reduce((s, t) => s + Number(t.amount), 0);\n      const totalCB = monthArr.reduce((t2, t) => {\n        const amt = Number(t.amount);\n        const cb = t.cashback_share_percent ? Math.round(amt * t.cashback_share_percent) : Number(t.cashback_share_fixed || 0);\n        return t2 + cb;\n      }, 0);\n\n      dv.header(3, `\uD83D\uDCC5 [[${month}]] \u2014 ${monthArr.length} giao d\u1ECBch | T\u1ED5ng: ${totalAmt.toLocaleString()} \u0111 | CB: ${totalCB.toLocaleString()} \u0111`);\n\n      dv.table(\n        [\"ID\", \"Ng\u00E0y\", \"Lo\u1EA1i\", \"S\u1ED1 ti\u1EC1n\", \"% CB\", \"CB C\u1ED1 \u0111\u1ECBnh\", \"\u03A3 CB\", \"Final Price\", \"Ghi ch\u00FA\"],\n        monthArr.map(t => {\n          const d = new Date(t.occurred_at);\n          const shortId = t.id ? t.id.substring(0, 5) : '-';\n          const amt = Number(t.amount);\n          const cbPct = Number(t.cashback_share_percent || 0);\n          const cbFixed = Number(t.cashback_share_fixed || 0);\n          const cbSum = cbPct > 0 ? Math.round(amt * cbPct) : cbFixed;\n          const fee = Number(t.metadata?.service_fee || 0);\n          const net = amt - cbSum + fee;\n          const sign = ['income','repayment','refund','transfer_in'].includes(t.type) ? '\uD83D\uDFE2 +' : '\uD83D\uDD34 -';\n          return [\n            `\\`${shortId}\\``,\n            d.toLocaleDateString('vi-VN'),\n            `${sign}${t.type}`,\n            `**${amt.toLocaleString()} \u0111**`,\n            cbPct > 0 ? `${(cbPct * 100).toFixed(1)}%` : '-',\n            cbFixed > 0 ? `${cbFixed.toLocaleString()} \u0111` : '-',\n            cbSum > 0 ? `${cbSum.toLocaleString()} \u0111` : '-',\n            `**${net.toLocaleString()} \u0111**`,\n            t.note || \"-\"\n          ];\n        })\n      );\n    }\n  }\n}\n```\n");
}
function generate() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, accRes, pplRes, accData, _i, accData_1, acc, safeName, filePath, pplData, _b, pplData_1, p, safeName, filePath;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('Fetching Accounts and People from Supabase...');
                    return [4 /*yield*/, Promise.all([
                            fetch("".concat(SUPABASE_URL, "/rest/v1/accounts?select=id,name"), { headers: headers }),
                            fetch("".concat(SUPABASE_URL, "/rest/v1/people?select=id,name"), { headers: headers })
                        ])];
                case 1:
                    _a = _c.sent(), accRes = _a[0], pplRes = _a[1];
                    if (!accRes.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, accRes.json()];
                case 2:
                    accData = _c.sent();
                    for (_i = 0, accData_1 = accData; _i < accData_1.length; _i++) {
                        acc = accData_1[_i];
                        safeName = acc.name.replace(/\//g, '-');
                        filePath = path_1.default.join(accountsDir, "".concat(safeName, ".md"));
                        fs_1.default.writeFileSync(filePath, accountPage(acc), 'utf8');
                        console.log("Created/Updated ".concat(filePath));
                    }
                    _c.label = 3;
                case 3:
                    if (!pplRes.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, pplRes.json()];
                case 4:
                    pplData = _c.sent();
                    for (_b = 0, pplData_1 = pplData; _b < pplData_1.length; _b++) {
                        p = pplData_1[_b];
                        safeName = p.name.replace(/\//g, '-');
                        filePath = path_1.default.join(peopleDir, "".concat(safeName, ".md"));
                        fs_1.default.writeFileSync(filePath, peoplePage(p), 'utf8');
                        console.log("Created/Updated ".concat(filePath));
                    }
                    _c.label = 5;
                case 5:
                    console.log("Done generating Obsidian Ecosystem Pages!");
                    return [2 /*return*/];
            }
        });
    });
}
generate().catch(console.error);
