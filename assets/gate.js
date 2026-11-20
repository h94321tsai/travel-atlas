// 密碼軟鎖:輸對一次後這台裝置記住(localStorage)。
// 只是擋路人的軟鎖 — GitHub Pages 是純靜態,trips.js/圖片網址仍是公開的。
// 換密碼:把新密碼的 SHA-256 填進 HASH(終端機:printf 新密碼 | shasum -a 256),舊裝置會被要求重輸。
(function(){
  var HASH = '73d3f1ba062585bce51f77d70a26be88c44b55d70f81b8bd7e2ded030ca4454a';
  var KEY = 'ta-unlocked';
  try{ if(localStorage.getItem(KEY) === HASH) return; }catch(e){}

  var root = document.documentElement;
  root.classList.add('ta-locked');
  var css = document.createElement('style');
  css.textContent =
    'html.ta-locked,html.ta-locked body{overflow:hidden!important;}' +
    'html.ta-locked body>*:not(#ta-gate){visibility:hidden!important;}' +
    '#ta-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;' +
      'background:#f1ebdd;color:#2c2a26;font-family:"Space Grotesk","Noto Sans TC",sans-serif;}' +
    '#ta-gate form{width:100%;max-width:320px;text-align:center;}' +
    '#ta-gate .ey{font-family:"Space Mono",monospace;font-size:.66rem;letter-spacing:.32em;text-transform:uppercase;color:#c9913f;font-weight:700;}' +
    '#ta-gate h1{font-family:"Noto Sans TC",sans-serif;font-size:2rem;margin:10px 0 22px;font-weight:700;}' +
    '#ta-gate h1 em{font-style:normal;font-weight:400;color:#e8795f;}' +
    '#ta-gate input{width:100%;font:inherit;font-size:1.1rem;text-align:center;letter-spacing:.3em;padding:12px 14px;' +
      'border:1px solid rgba(44,42,38,.2);border-radius:30px;background:#f8f2e4;color:#2c2a26;outline:none;}' +
    '#ta-gate input:focus{border-color:#2c2a26;}' +
    '#ta-gate button{margin-top:12px;width:100%;font-family:"Space Mono",monospace;font-size:.8rem;letter-spacing:.1em;' +
      'padding:12px;border:none;border-radius:30px;background:#2c2a26;color:#f1ebdd;cursor:pointer;}' +
    '#ta-gate .err{min-height:1.4em;margin-top:12px;font-size:.82rem;color:#c0544a;}' +
    '#ta-gate.shake form{animation:ta-shake .35s;}' +
    '@keyframes ta-shake{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}';
  (document.head || root).appendChild(css);

  function sha256(s){
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function(buf){
      return Array.prototype.map.call(new Uint8Array(buf), function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }

  function mount(){
    var gate = document.createElement('div');
    gate.id = 'ta-gate';
    gate.innerHTML =
      '<form autocomplete="off">' +
        '<div class="ey">Travel Atlas</div>' +
        '<h1>旅行的<em> 檔案室</em></h1>' +
        '<input type="password" inputmode="numeric" placeholder="輸入密碼" aria-label="密碼" autofocus>' +
        '<button type="submit">打開</button>' +
        '<div class="err" role="alert"></div>' +
      '</form>';
    document.body.appendChild(gate);
    var form = gate.querySelector('form'), input = gate.querySelector('input'), err = gate.querySelector('.err');
    input.focus();
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      sha256(input.value.trim()).then(function(h){
        if(h === HASH){
          try{ localStorage.setItem(KEY, HASH); }catch(e){}
          gate.remove();
          root.classList.remove('ta-locked');
          window.dispatchEvent(new Event('resize'));
        }else{
          err.textContent = '密碼不對,再試一次';
          input.value = '';
          gate.classList.remove('shake'); void gate.offsetWidth; gate.classList.add('shake');
        }
      });
    });
  }
  if(document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
