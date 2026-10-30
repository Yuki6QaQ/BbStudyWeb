let questionList = [];
let currentQ = null;
let currentMode = MODE_RAND;
//顺序模式下标
let orderIndex = 0;

//【核心：会话池】随机/错题模式进入会话一次性生成整套题目，游标移动，不再实时随机
let sessionPool = [];
let sessionCursor = 0;

//字母答案转数组下标 A=0,B=1,C=2,D=3
function ansLetterToIndex(letter) {
    const map = { "A": 0, "B": 1, "C": 2, "D": 3 };
    return map[letter] ?? 0;
}

//洗牌Fisher‑Yates
function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

//清除会话：UI缓存 + 销毁会话题目池
function clearSessionAnswerCache() {
    localStorage.removeItem(ANS_CACHE_KEY);
    sessionPool = [];
    sessionCursor = 0;
}

//加载题库
async function loadQuiz() {
    const resp = await fetch(JSON_URL);
    questionList = await resp.json();
}

//构建【随机模式会话池】全部题目洗牌
function buildRandPool() {
    sessionPool = shuffleArray([...questionList]);
    sessionCursor = 0;
}

//构建【错题模式会话池】：错题加权，错越多权重越高，之后洗牌
function buildWrongPool() {
    const rec = getRec();
    //拿到所有有错题记录的题目
    const rawWrong = questionList.filter(q => {
        const r = rec[q.id];
        return r && r.wrong > 0;
    });
    //加权复制，最多复制4份，提高高频错题概率
    let weighted = [];
    rawWrong.forEach(q => {
        const cnt = Math.min(rec[q.id].wrong, 4);
        for (let i = 0; i < cnt; i++) weighted.push(q);
    })
    //去重再洗牌
    const uniqueIds = [...new Set(weighted.map(x => x.id))];
    sessionPool = shuffleArray(uniqueIds.map(id => rawWrong.find(q => q.id === id)));
    sessionCursor = 0;
}

//下一题
function goNext() {
    if (currentMode === "order") {
        //顺序模式：直接移动题号下标
        orderIndex += 1;
        if (orderIndex >= questionList.length) {
            orderIndex = questionList.length - 1;
            currentQ = null;
        } else {
            currentQ = questionList[orderIndex];
        }
    } else {
        //随机 / 错题模式：操作会话池游标，不重新随机！
        sessionCursor += 1;
        if (sessionCursor >= sessionPool.length) {
            currentQ = null;
        } else {
            currentQ = sessionPool[sessionCursor];
        }
    }

    let totalCnt;
    if (currentMode === "order") totalCnt = questionList.length;
    else if (currentMode === MODE_WRONG) totalCnt = sessionPool.length;
    else totalCnt = sessionPool.length;

    renderQuestion(currentQ, totalCnt, onUserSelectAnswer);

    if (currentMode === "order") {
        $("#prevBtn").disabled = orderIndex <= 0;
    } else {
        $("#prevBtn").disabled = sessionCursor <= 0;
    }
}

//上一题
function goPrev() {
    if (currentMode === "order") {
        if (orderIndex <= 0) return;
        orderIndex -= 1;
        currentQ = questionList[orderIndex];
    } else {
        if (sessionCursor <= 0) return;
        sessionCursor -= 1;
        currentQ = sessionPool[sessionCursor];
    }

    let totalCnt;
    if (currentMode === "order") totalCnt = questionList.length;
    else if (currentMode === MODE_WRONG) totalCnt = sessionPool.length;
    else totalCnt = sessionPool.length;

    renderQuestion(currentQ, totalCnt, onUserSelectAnswer);

    if (currentMode === "order") {
        $("#prevBtn").disabled = orderIndex <= 0;
    } else {
        $("#prevBtn").disabled = sessionCursor <= 0;
    }
}

function getWrongCount() {
    const rec = getRec();
    return questionList.filter(q => {
        const r = rec[q.id];
        return r && r.wrong > 0;
    }).length;
}

//用户点击选项
function onUserSelectAnswer(selectedIdx) {
    if (!currentQ) return;
    const rightIdx = ansLetterToIndex(currentQ.answer);
    const isOk = selectedIdx === rightIdx;
    submitDo(currentQ.id, isOk);
    renderAnswerResult(selectedIdx, rightIdx, currentQ);
}

//绑定全部事件
function bindEvents() {
    //主题切换
    $("#themeBtn").onclick = () => {
        const isDark = document.body.classList.contains("dark");
        const nextTheme = isDark ? "light" : "dark";
        applyTheme(nextTheme);
        setSavedTheme(nextTheme);
    }

    //随机刷题【进入时一次性构建会话池】
    $("#randBtn").onclick = () => {
        currentMode = MODE_RAND;
        $("#modeBadge").innerText = "随机刷题";
        clearSessionAnswerCache();
        buildRandPool();
        currentQ = sessionPool[sessionCursor];
        showPage("quiz");
        renderQuestion(currentQ, sessionPool.length, onUserSelectAnswer);
        $("#prevBtn").disabled = sessionCursor <= 0;
    };

    //顺序答题
    $("#orderBtn").onclick = () => {
        currentMode = "order";
        $("#modeBadge").innerText = "顺序答题";
        clearSessionAnswerCache();
        orderIndex = 0;
        currentQ = questionList[0];
        showPage("quiz");
        renderQuestion(currentQ, questionList.length, onUserSelectAnswer);
        $("#prevBtn").disabled = true;
    };

    $("#wrongBookBtn").onclick = () => {
        renderWrongList(questionList);
        showPage("wrongList");
    };
    $("#statBtn").onclick = () => {
        const stat = getGlobalStat();
        $("#stTotal").innerText = stat.total;
        $("#stOk").innerText = stat.ok;
        $("#stErr").innerText = stat.err;
        $("#stRate").innerText = stat.rate;
        renderSingleStatList(questionList);
        showPage("stat");
    };
    $("#settingBtn").onclick = () => showPage("setting");

    //刷题页
    $("#nextBtn").onclick = goNext;
    $("#prevBtn").onclick = goPrev;
    $("#quizBackHome").onclick = () => {
        clearSessionAnswerCache();
        showPage("home");
    };

    //错题本页面【开始刷错题：构建错题会话池】
    $("#startWrongQuiz").onclick = () => {
        currentMode = MODE_WRONG;
        $("#modeBadge").innerText = "错题刷题";
        clearSessionAnswerCache();
        buildWrongPool();
        if (sessionPool.length === 0) {
            alert("暂无错题可以练习");
            showPage("wrongList");
            return;
        }
        currentQ = sessionPool[sessionCursor];
        showPage("quiz");
        renderQuestion(currentQ, sessionPool.length, onUserSelectAnswer);
        $("#prevBtn").disabled = sessionCursor <= 0;
    };

    $("#wrongListBack").onclick = () => showPage("home");
    $("#statBackHome").onclick = () => showPage("home");
    $("#settingBack").onclick = () => showPage("home");

    $("#exportRec").onclick = exportAllData;

    $("#importRecBtn").onclick = () => {
        $("#importTextarea").classList.remove("hidden");
        $("#confirmImport").classList.remove("hidden");
    };

    //文件导入
    $("#fileImportInput").onchange = async function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            try {
                const jsonStr = ev.target.result;
                importAllData(jsonStr);
                alert("✅文件导入成功！");
            } catch (err) {
                alert("❌文件解析失败，不是有效的备份json");
                console.error(err);
            }
            $("#fileImportInput").value = "";
        }
        reader.onerror = () => {
            alert("❌读取文件出错");
            $("#fileImportInput").value = "";
        }
        reader.readAsText(file);
    }

    $("#confirmImport").onclick = () => {
        try {
            importAllData($("#importTextarea").value.trim());
            alert("✅粘贴导入成功");
            $("#importTextarea").value = "";
            $("#importTextarea").classList.add("hidden");
            $("#confirmImport").classList.add("hidden");
        } catch (e) {
            alert("❌JSON格式错误");
        }
    };

    $("#resetAll").onclick = () => {
        if (confirm("⚠确定清空全部做题记录？操作不可恢复！")) {
            clearAllStorage();
            alert("已清空");
            showPage("home");
        }
    };
    $("#closeModal").onclick = () => $("#modalMask").classList.add("hidden");
}

//程序入口
async function bootstrap() {
    const theme = getSavedTheme();
    applyTheme(theme);
    await loadQuiz();
    bindEvents();
    showPage("home");
}

bootstrap();
