// --- Auto-refresh live sync every 15 seconds ---
let lastFetchedData = null;
let activeCode = null;
const REFRESH_INTERVAL = 15000; // 15 seconds

function startAutoRefresh() {
  if (!activeCode) return;
  setInterval(() => {
    google.script.run.withSuccessHandler(function(res) {
      if (res && res.status === 'ok') {
        const newData = res.data;
        if (JSON.stringify(newData) !== JSON.stringify(lastFetchedData)) {
          fillFetchedData(newData);
          lastFetchedData = newData;
          document.getElementById('syncStatus').textContent = 'Updated 🔄';
          setTimeout(()=>document.getElementById('syncStatus').textContent='Synced ✓', 2000);
        }
      }
    }).getByCode(activeCode);
  }, REFRESH_INTERVAL);
}

// Inside your onFetch() add:
function onFetch() {
  const code = codeInput.value.trim();
  if (!code) return alert('Enter code');
  activeCode = code;
  google.script.run.withSuccessHandler(function(res){
    if(res.status==='ok'){ 
      fillFetchedData(res.data); 
      lastFetchedData = res.data;
      startAutoRefresh();
    } else alert(res.message || 'Not found');
  }).getByCode(code);
}
