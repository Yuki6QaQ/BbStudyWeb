//做题统计记录 {qid:{ok:number,wrong:number}}
function getRec() {
    const raw = localStorage.getItem(RECORD_KEY);
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (e) { return {}; }
}
function saveRec(obj) {
    localStorage.setItem(RECORD_KEY, JSON.stringify(obj));
}

//作答UI会话缓存（只存本次会话选中状态）
function getAnsCache() {
    const raw = localStorage.getItem(ANS_CACHE_KEY);
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (e) { return {}; }
}
function saveAnsCache(qid, selIdx, showTip) {
    const cache = getAnsCache();
    cache[qid] = { selIdx: selIdx, showTip: showTip };
    localStorage.setItem(ANS_CACHE_KEY, JSON.stringify(cache));
}

//提交作答，更新ok/wrong计数
function submitDo(qid, isOk) {
    const r = getRec();
    if (!r[qid]) r[qid] = { ok: 0, wrong: 0 };
    if (isOk) r[qid].ok += 1;
    else r[qid].wrong += 1;
    saveRec(r);
}

//全局统计
function getGlobalStat() {
    const r = getRec();
    let ok = 0, err = 0, total = 0;
    Object.values(r).forEach(item => {
        ok += item.ok;
        err += item.wrong;
        total += item.ok + item.wrong;
    })
    const rate = total > 0 ? ((ok / total) * 100).toFixed(1) + "%" : "0%";
    return { total, ok, err, rate };
}

//导出全部（只导出统计记录，不导出UI会话缓存）
function exportAllData() {
    const data = {
        record: getRec()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "quiz_backup.json";
    a.click();
}

//导入备份
function importAllData(jsonStr) {
    const obj = JSON.parse(jsonStr);
    if (obj.record) saveRec(obj.record);
}

//清空全部存储
function clearAllStorage() {
    localStorage.removeItem(RECORD_KEY);
    localStorage.removeItem(ANS_CACHE_KEY);
    localStorage.removeItem(THEME_STORE_KEY);
}

//主题
function getSavedTheme() {
    return localStorage.getItem(THEME_STORE_KEY) || "light";
}
function setSavedTheme(val) {
    localStorage.setItem(THEME_STORE_KEY, val);
}
