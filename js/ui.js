//切换面板【增加DOM容错】
function showPage(pageId) {
    $$(".page").forEach(el => el.classList.add("hidden"));
    const targetPage = $(`#${pageId}Page`);
    if (targetPage) targetPage.classList.remove("hidden");

    const mask = $("#modalMask");
    if (mask) mask.classList.add("hidden");
}

/**
 * 渲染普通刷题题目（显示历史对错统计）
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
 * 用户选择答案之后渲染结果【普通刷题】
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

// ====== 【新增考试渲染函数，追加到ui.js末尾】======
function renderExamQuestion() {
    const q = examPool[examCursor];
    $("#examCur").innerText = examCursor + 1;
    $("#examTotal").innerText = examPool.length;
    $("#examTitle").innerText = q.title;
    $("#examOptList").innerHTML = "";

    q.options.forEach((optStr, idx) => {
        const div = document.createElement("div");
        div.className = "option";
        div.innerText = optStr;
        div.onclick = () => {
            examUserAnswers[examCursor].selIdx = idx;
            renderAnswerCard();
        };
        $("#examOptList").appendChild(div);
    })
    $("#examPrev").disabled = examCursor <= 0;
    $("#examNext").disabled = examCursor >= examPool.length - 1;
}

function renderAnswerCard() {
    const box = $("#answerCardBox");
    box.innerHTML = "";
    examUserAnswers.forEach((item, i) => {
        const span = document.createElement("span");
        span.innerText = i + 1;
        if (item.selIdx !== null) span.classList.add("done");
        span.onclick = () => {
            examCursor = i;
            renderExamQuestion();
        }
        box.appendChild(span);
    })
}

function renderExamRecordList() {
    const wrap = $("#examRecordWrap");
    wrap.innerHTML = "";
    const list = getExamHistory();
    if (list.length === 0) {
        wrap.innerHTML = `<div class="empty-text">暂无模拟考试记录</div>`;
        return;
    }
    list.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "single-item";
        div.innerText = `📅${item.date}｜得分：${item.score}/${item.total}｜用时：${item.useTime}｜错题${item.wrongCount}道`;
        div.dataset.index = idx;
        div.onclick = () => openExamReview(idx);
        wrap.appendChild(div);
    })
}

function renderReviewQuestion() {
    const q = reviewExamData.questions[currentReviewIndex];
    const detail = reviewExamData.answerDetail[currentReviewIndex];
    $("#revCur").innerText = currentReviewIndex + 1;
    $("#revTotal").innerText = reviewExamData.questions.length;
    $("#revTitle").innerText = q.title;
    $("#revOptList").innerHTML = "";

    q.options.forEach((optStr, idx) => {
        const div = document.createElement("div");
        div.className = "option";
        div.innerText = optStr;
        if (idx === detail.rightIdx) div.classList.add("right");
        if (detail.userAnsIdx !== null && idx === detail.userAnsIdx && !detail.isRight) {
            div.classList.add("wrong");
        }
        $("#revOptList").appendChild(div);
    })

    if (detail.isRight) {
        $("#revFeedback").innerText = "✅作答正确";
    } else {
        $("#revFeedback").innerText = "❌作答错误";
    }

    if (q.tip && q.tip.trim() !== "") {
        $("#revTipText").innerHTML = q.tip.replaceAll("\\n", "<br>");
        $("#revTipBox").classList.remove("hidden");
    } else {
        $("#revTipBox").classList.add("hidden");
    }
    $("#revPrev").disabled = currentReviewIndex <= 0;
    $("#revNext").disabled = currentReviewIndex >= reviewExamData.questions.length - 1;
}
