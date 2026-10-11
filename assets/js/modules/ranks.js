/* Training statuses module: read-only approved taxonomy. */
(()=>{const A=window.FFAdmin;
A.modules.ranks={render(){A.$('#ranks-list').innerHTML=A.topics.ranks.map(([id,label])=>`<div class="catalog-item"><div class="number-icon accent">${id}%</div><div><strong>${A.escape(label)}</strong><small>Отдельная папка видеоуроков</small></div></div>`).join('');}};
})();
