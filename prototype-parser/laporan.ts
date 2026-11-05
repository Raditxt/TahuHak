// PROTOTYPE — membuat out/laporan.html dari out/<id>.json untuk pengecekan manual terhadap PDF.
// Jalankan: bun run laporan.ts, lalu buka out/laporan.html (klik dua kali, tanpa server).
import { readFileSync, writeFileSync } from "node:fs";

const ids = ["uu-13-2003", "uu-6-2023", "pp-35-2021", "perda-mks-1983", "perda-mks-1983-ocr"];
const data = Object.fromEntries(ids.map((id) => [id, JSON.parse(readFileSync(`out/${id}.json`, "utf8"))]));

const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Laporan Parser</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1b16;--mut:#6b675d;--line:#e4e0d6;--acc:#2f5d50;--warn:#9a5b00;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#16150f;--fg:#ece8dc;--mut:#a39e90;--line:#34322a;--acc:#7fc2ad;--warn:#e0a24a;--card:#1e1d16}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,sans-serif}
main{max-width:1000px;margin:0 auto;padding:24px 16px 80px}h1{font-size:22px;margin:0 0 4px}p.lead{color:var(--mut);margin:0 0 20px}
nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}nav button{border:1px solid var(--line);background:var(--card);color:var(--fg);padding:6px 12px;border-radius:6px;cursor:pointer;font:inherit}
nav button[aria-pressed=true]{border-color:var(--acc);color:var(--acc);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px}.stat b{display:block;font-size:20px}.stat span{color:var(--mut);font-size:13px}
h2{font-size:17px;margin:24px 0 8px}details{background:var(--card);border:1px solid var(--line);border-radius:6px;margin:4px 0;padding:6px 10px}
summary{cursor:pointer}summary small{color:var(--mut)}.ayat{margin:6px 0 6px 8px;white-space:pre-wrap}.ayat i{color:var(--acc);font-style:normal;font-weight:600}
.penj{border-left:3px solid var(--line);padding-left:10px;color:var(--mut);white-space:pre-wrap;margin-top:6px}
ul.warn li{color:var(--warn);margin:2px 0;word-break:break-word}input{font:inherit;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg);width:100%;max-width:340px;margin-bottom:8px}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}.tbl{overflow-x:auto}
</style></head><body><main>
<h1>Laporan Parser Peraturan (PROTOTYPE, issue #2)</h1>
<p class="lead">Hasil pdfjs → pembersih → parser struktur → parser perubahan atas empat dokumen. Cocokkan dengan PDF resmi pada nomor halaman yang tertera.</p>
<nav id="tabs"></nav><div id="isi"></div>
<script>
const D=${JSON.stringify(data)};
const esc=s=>String(s??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const tabs=document.getElementById("tabs"),isi=document.getElementById("isi");
function pasalHTML(ps){return ps.map(p=>'<details><summary>Pasal '+esc(p.nomor)+(p.mengubah?' — mengubah '+esc(p.mengubah):'')+' <small>hal '+p.halaman.join(", ")+' · '+p.ayat.length+' ayat</small></summary>'+p.ayat.map(a=>'<div class="ayat">'+(a.nomor?'<i>('+esc(a.nomor)+')</i> ':'')+esc(a.teks)+'</div>').join("")+(p.penjelasan?'<div class="penj"><b>Penjelasan</b>\\n'+esc(p.penjelasan)+'</div>':'')+'</details>').join("")}
function tampil(id){
  [...tabs.children].forEach(b=>b.setAttribute("aria-pressed",b.dataset.id===id));
  const r=D[id],k=r.kualitas;
  let h='<div class="grid">'+[["Asal Teks",r.peraturan.asalTeks],["Kualitas",k.nilai],["Kata aneh",k.anehPer1000+"‰"],["Pasal",r.pasal.length],["Pasal Lampiran",r.lampiran?r.lampiran.pasal.length:"–"],["Perubahan",r.perubahan.length],["Peringatan",r.peringatan.length]].map(([a,b])=>'<div class="stat"><b>'+esc(b)+'</b><span>'+a+'</span></div>').join("")+'</div>';
  h+='<p><b>'+esc(r.peraturan.jenis+" "+r.peraturan.nomor+"/"+r.peraturan.tahun)+'</b> — '+esc(r.peraturan.judul)+'</p>';
  h+='<p class="lead">Dibuang: '+Object.entries(r.pembersihan).map(([a,b])=>a+" "+b).join(" · ")+'</p>';
  h+='<h2>Peringatan (tinjauan manual)</h2><ul class="warn">'+(r.peringatan.map(w=>'<li>'+esc(w)+'</li>').join("")||'<li style="color:var(--mut)">tidak ada</li>')+'</ul>';
  if(r.perubahan.length){h+='<h2>Perubahan</h2><input id="f" placeholder="Saring: mis. Pasal 81, 156, sisip"><div class="tbl"><table><thead><tr><th>Rujukan</th><th>Jenis</th><th>Target</th><th>Cakupan</th><th>Hal</th><th>Teks baru</th></tr></thead><tbody id="tb"></tbody></table></div>';}
  h+='<h2>Pasal batang tubuh</h2>'+pasalHTML(r.pasal);
  if(r.lampiran) h+='<h2>Pasal Lampiran</h2>'+pasalHTML(r.lampiran.pasal);
  isi.innerHTML=h;
  const f=document.getElementById("f");
  if(f){const isiTb=q=>{document.getElementById("tb").innerHTML=r.perubahan.filter(x=>!q||JSON.stringify([x.rujukan,x.jenis,x.target]).toLowerCase().includes(q.toLowerCase())).slice(0,400).map(x=>'<tr><td>'+esc(x.rujukan)+'</td><td>'+x.jenis+'</td><td>'+esc(x.target.peraturan+" Pasal "+x.target.pasal+(x.target.ayat?" ayat "+x.target.ayat:""))+'</td><td>'+x.cakupan+'</td><td>'+x.halaman.join(", ")+'</td><td><details><summary><small>'+esc((x.teksBaru||"—").slice(0,60))+'</small></summary><div class="ayat">'+(x.ayatBaru?x.ayatBaru.map(a=>(a.nomor?'<i>('+esc(a.nomor)+')</i> ':'')+esc(a.teks)).join("\\n\\n"):esc(x.teksBaru||""))+'</div></details></td></tr>').join("")};f.value="Pasal 81 ";isiTb(f.value);f.oninput=()=>isiTb(f.value);}
}
Object.keys(D).forEach(id=>{const b=document.createElement("button");b.textContent=id;b.dataset.id=id;b.onclick=()=>tampil(id);tabs.appendChild(b)});
tampil("uu-6-2023");
</script></main></body></html>`;
writeFileSync("out/laporan.html", html);
console.log("out/laporan.html", (html.length / 1e6).toFixed(1), "MB");
