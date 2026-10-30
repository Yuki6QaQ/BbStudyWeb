//切换面板
function showPage(pageId) {
    $$(".page").forEach(el => el.classList.add("hidden"));
    $(`#${pageId}Page`).classList.remove("hidden");
    $("#modalMask").classList.add("hidden");
}

/**
 * 渲染题目
 * @param {Object|null} q 题目对象
 * @param {Number} totalCnt 总题数
 * @param {Function} onUserSelect 用户点击选项回调
 */
function renderQuestion(q, totalCnt, onUserSelect) {
    $("#feedbackBox").innerText = "";
    $("#tipBox").classList.add("hidden");
    $("#optList").innerHTML = "";

    if (!q) {
        $("#qCurId").innerText = "0";
        $("#qTotal").innerText = totalCnt;
        $("#qTitle").innerText = "没有可用题目";
        $("#qHintStat").style.display = "none";
        return;
    }
    $("#qCurId").innerText = q.id;
    $("#qTotal").innerText = totalCnt;
    $("#qTitle").innerText = q.title;
    $("#qHintStat").style.display = "block";

    //渲染本题历史作答统计
    const rec = getRec();
    const qRec = rec[q.id] ?? { ok: 0, wrong: 0 };
    $("#qOk").innerText = qRec.ok;
    $("#qErr").innerText = qRec.wrong;

    //生成选项dom
    q.options.forEach((optStr, idx) => {
        const div = document.createElement("div");
        div.className = "option";
        div.innerText = optStr;
        div.onclick = () => onUserSelect(idx);
        $("#optList").appendChild(div);
    })

    //读取【本地会话缓存ansCache】复原上次作答状态（仅限当前刷题会话）
    const cache = getAnsCache();
    const itemCache = cache[q.id];
    if (itemCache) {
        const optsDom = $$(".option");
        const rightIdx = ansLetterToIndex(q.answer);
        const selIdx = itemCache.selIdx;
        optsDom.forEach(d => d.style.pointerEvents = "none");
        if (selIdx === rightIdx) {
            optsDom[selIdx].classList.add("right");
            $("#feedbackBox").innerText = "✅答对啦，很棒！";
        } else {
            optsDom[selIdx].classList.add("wrong");
            optsDom[rightIdx].classList.add("right");
            $("#feedbackBox").innerText = "❌答错，请看解析提示";
            if (itemCache.showTip && q.tip) {
                $("#tipText").innerHTML = q.tip.replaceAll("\\n", "<br>");
                $("#tipBox").classList.remove("hidden");
            }
        }
    }
}

/**
 * 用户选择答案之后渲染结果
 */
function renderAnswerResult(selectedIdx, rightIdx, qObj) {
    const optsDom = $$(".option");
    optsDom.forEach(d => d.style.pointerEvents = "none");
    let showTipFlag = false;
    if (selectedIdx === rightIdx) {
        optsDom[selectedIdx].classList.add("right");
        $("#feedbackBox").innerText = "✅答对啦，很棒！";
        $("#tipBox").classList.add("hidden");
        showTipFlag = false;
    } else {
        optsDom[selectedIdx].classList.add("wrong");
        optsDom[rightIdx].classList.add("right");
        $("#feedbackBox").innerText = "❌答错，请看解析提示";
        if (qObj.tip && qObj.tip.trim() !== "") {
            $("#tipText").innerHTML = qObj.tip.replaceAll("\\n", "<br>");
            $("#tipBox").classList.remove("hidden");
            showTipFlag = true;
        }
    }
    saveAnsCache(qObj.id, selectedIdx, showTipFlag);
    //作答完立刻刷新页面上【本题统计数字】
    const rec = getRec();
    const qRec = rec[qObj.id] ?? { ok: 0, wrong: 0 };
    $("#qOk").innerText = qRec.ok;
    $("#qErr").innerText = qRec.wrong;
}

//渲染错题本列表【新增：点击条目弹窗查看完整题目】
function renderWrongList(allQuestion) {
    const wrap = $("#wrongListWrap");
    wrap.innerHTML = "";
    const rec = getRec();
    const wrongQList = allQuestion.filter(q => {
        const r = rec[q.id];
        return r && r.wrong > 0;
    });
    if (wrongQList.length === 0) {
        wrap.innerHTML = `<div class="empty-text">🎉暂无错题！</div>`;
        return;
    }
    wrongQList.forEach(q => {
        const r = rec[q.id];
        const div = document.createElement("div");
        div.className = "single-item";
        div.innerText = `#${q.id} ${q.title.slice(0, 45)}... | ✅${r.ok}次  ❌${r.wrong}次`;
        //点击弹窗，复用弹窗组件
        div.onclick = () => {
            $("#modalTitle").innerText = `第${q.id}题`;
            $("#mOk").innerText = r.ok;
            $("#mErr").innerText = r.wrong;
            $("#modalQText").innerText = q.title;
            const optWrap = $("#modalOptWrap");
            optWrap.innerHTML = "";
            q.options.forEach(optStr => {
                const d = document.createElement("div");
                d.innerText = optStr;
                optWrap.appendChild(d);
            })
            $("#modalRightAns").innerText = q.answer;
            if (q.tip && q.tip.trim() !== "") {
                $("#modalTip").innerHTML = q.tip.replaceAll("\\n", "<br>");
            } else {
                $("#modalTip").innerText = "（本题无解析tip）";
            }
            $("#modalMask").classList.remove("hidden");
        }
        wrap.appendChild(div);
    })
}

//渲染统计页面单题列表，弹窗展示完整题目信息
function renderSingleStatList(allQuestion) {
    const wrap = $("#singleStatWrap");
    wrap.innerHTML = "";
    const rec = getRec();
    allQuestion.forEach(q => {
        const r = rec[q.id] || { ok: 0, wrong: 0 };
        const div = document.createElement("div");
        div.className = "single-item";
        div.innerText = `#${q.id} ${q.title.slice(0, 45)}... | ✅${r.ok}  ❌${r.wrong}`;
        div.onclick = () => {
            $("#modalTitle").innerText = `第${q.id}题`;
            $("#mOk").innerText = r.ok;
            $("#mErr").innerText = r.wrong;
            $("#modalQText").innerText = q.title;
            const optWrap = $("#modalOptWrap");
            optWrap.innerHTML = "";
            q.options.forEach(optStr => {
                const d = document.createElement("div");
                d.innerText = optStr;
                optWrap.appendChild(d);
            })
            $("#modalRightAns").innerText = q.answer;
            if (q.tip && q.tip.trim() !== "") {
                $("#modalTip").innerHTML = q.tip.replaceAll("\\n", "<br>");
            } else {
                $("#modalTip").innerText = "（本题无解析tip）";
            }
            $("#modalMask").classList.remove("hidden");
        }
        wrap.appendChild(div);
    })
}

//应用主题
function applyTheme(themeVal) {
    if (themeVal === "dark") {
        document.body.classList.add("dark");
        $("#themeBtn").innerText = "☀️";
    } else {
        document.body.classList.remove("dark");
        $("#themeBtn").innerText = "🌙";
    }
}
