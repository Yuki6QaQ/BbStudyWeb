let currentQ = null;
let currentMode = MODE_RAND;
let orderIndex = 0;
let sessionPool = [];
let sessionCursor = 0;

// =========【新增：模拟考试全局变量】========
let examPool = [];
let examCursor = 0;
let examUserAnswers = [];
let examTimer = null;
let examRemainSec = 0;
let currentReviewIndex = -1;
let reviewExamData = null;

//字母答案转数组下标 A=0,B=1,C=2,D=3
function ansLetterToIndex(letter) {
    const map = { "A": 0, "B": 1, "C": 2, "D": 3 };
    return map[letter] ?? 0;
}

//Fisher‑Yates 洗牌算法
function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

//清除刷题会话界面UI缓存，**不会清除做题统计记录rec！**
function clearSessionAnswerCache() {
    localStorage.removeItem(ANS_CACHE_KEY);
    sessionPool = [];
    sessionCursor = 0;
}

//加载题库（复用原版question.js）
async function loadQuiz() {
    await loadQuestions();
    questionList = getQuestionList();
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
    let pool = questionList.filter(q => {
        const r = rec[q.id];
        return r && r.wrong > 0;
    });
    //加权复制，最多复制4份，提高高频错题概率
    let weighted = [];
    pool.forEach(q => {
        const r = rec[q.id] || { wrong: 1 };
        const times = Math.min(r.wrong, 4);
        for (let i = 0; i < times; i++) weighted.push(q);
    })
    //去重再洗牌
    const uniqueIds = Array.from(new Set(weighted.map(x => x.id)));
    sessionPool = shuffleArray(uniqueIds.map(id => pool.find(q => q.id === id)));
    sessionCursor = 0;
}

//下一题【普通刷题】
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

//上一题【普通刷题】
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

//用户点击选项【普通刷题】
function onUserSelectAnswer(selectedIdx) {
    if (!currentQ) return;
    const rightIdx = ansLetterToIndex(currentQ.answer);
    const isOk = selectedIdx === rightIdx;
    submitDo(currentQ.id, isOk);
    renderAnswerResult(selectedIdx, rightIdx, currentQ);
}

//=====================【新增：模拟考试全套业务函数】=====================
function startExam() {
    examPool = shuffleArray([...questionList]).slice(0, EXAM_QUESTION_COUNT);
    examCursor = 0;
    examRemainSec = EXAM_DURATION_SEC;
    examUserAnswers = examPool.map(q => ({ qid: q.id, selIdx: null }));
    showPage("exam");
    renderExamQuestion();
    renderAnswerCard();
    startExamCountDown();
}

function startExamCountDown() {
    if (examTimer) clearInterval(examTimer);
    updateCountDownDom();
    examTimer = setInterval(() => {
        examRemainSec -= 1;
        updateCountDownDom();
        if (examRemainSec <= 0) {
            clearInterval(examTimer);
            alert("⏰考试时间已到，自动交卷！");
            submitExam();
        }
    }, 1000);
}
function updateCountDownDom() {
    const m = Math.floor(examRemainSec / 60);
    const s = examRemainSec % 60;
    $("#examCountDown").innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getScoreTip(score, total) {
    const rate = score / total;
    if (rate >= 0.85) {
        return "🎉优秀！掌握很不错，少量错题复盘巩固。";
    } else if (rate >= 0.70) {
        return "👍良好，部分知识点需要加强练习。";
    } else if (rate >= 0.60) {
        return "⚠刚好及格，需要大量刷题复习薄弱点。";
    } else {
        return "❕不及格，建议回归基础，多练习巩固知识点。";
    }
}

//交卷 / 中途退出结算
function submitExam() {
    clearInterval(examTimer);
    let rightCnt = 0;
    let wrongList = [];
    const answerDetail = [];
    examPool.forEach((q, i) => {
        const selIdx = examUserAnswers[i].selIdx;
        const rightIdx = ansLetterToIndex(q.answer);
        const isRight = selIdx === rightIdx;
        if (isRight) rightCnt++;
        else wrongList.push(q.id);
        if (selIdx !== null) {
            submitDo(q.id, isRight);
        }
        answerDetail.push({
            qid: q.id,
            userAnsIdx: selIdx,
            rightIdx: rightIdx,
            isRight: isRight
        })
    })
    const score = rightCnt;
    const usedSec = EXAM_DURATION_SEC - examRemainSec;
    const useMin = Math.floor(usedSec / 60);
    const useSec = usedSec % 60;
    const useTimeStr = `${useMin}分${useSec}秒`;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const recordItem = {
        id: now.getTime(),
        date: dateStr,
        score: score,
        total: examPool.length,
        useTime: useTimeStr,
        wrongCount: wrongList.length,
        wrongList: wrongList,
        questions: JSON.parse(JSON.stringify(examPool)),
        answerDetail: answerDetail
    };
    pushExamRecord(recordItem);
    const tipText = getScoreTip(score, examPool.length);
    alert(`✅考试结算完成！得分：${score}/${examPool.length}，错题：${wrongList.length}道\n${tipText}\n记录已保存，可前往【考试记录】回看试卷`);
    showPage("home");
}

function quitExam() {
    if (!confirm("确定退出模拟考试？将会以你当前已经作答的题目直接结算成绩并保存考试记录！")) return;
    submitExam();
}

function openExamReview(listIndex) {
    const list = getExamHistory();
    reviewExamData = list[listIndex];
    currentReviewIndex = 0;
    showPage("examReview");
    renderReviewQuestion();
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

    //首页按钮 随机刷题
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
        if (confirm("⚠确定清空全部做题记录与考试历史？操作不可恢复！")) {
            clearAllStorage();
            alert("已清空");
            showPage("home");
        }
    };
    $("#closeModal").onclick = () => {
        const mask = $("#modalMask");
        if (mask) mask.classList.add("hidden");
    }

    // --------【新增模拟考试按钮事件，放在bindEvents末尾】--------
    $("#examStartBtn").onclick = () => {
        if (questionList.length < EXAM_QUESTION_COUNT) {
            alert(`题库题目不足${EXAM_QUESTION_COUNT}道，无法开启模拟考试`);
            return;
        }
        if (!confirm(`模拟考试共${EXAM_QUESTION_COUNT}题，限时30分钟。中途退出会直接结算当前成绩并保存记录，确定开始？`)) return;
        startExam();
    }
    $("#examRecordBtn").onclick = () => {
        renderExamRecordList();
        showPage("examRecord");
    }
    $("#examPrev").onclick = () => {
        if (examCursor <= 0) return;
        examCursor -= 1;
        renderExamQuestion();
    }
    $("#examNext").onclick = () => {
        if (examCursor >= examPool.length - 1) return;
        examCursor += 1;
        renderExamQuestion();
    }
    $("#examSubmitBtn").onclick = () => {
        if (!confirm("确认交卷？交卷后不可修改答案！")) return;
        submitExam();
    }
    $("#examQuitBtn").onclick = quitExam;

    //试卷回看页面
    $("#revPrev").onclick = () => {
        if (currentReviewIndex <= 0) return;
        currentReviewIndex -= 1;
        renderReviewQuestion();
    }
    $("#revNext").onclick = () => {
        if (currentReviewIndex >= reviewExamData.questions.length - 1) return;
        currentReviewIndex += 1;
        renderReviewQuestion();
    }
    $("#reviewBackRecord").onclick = () => {
        renderExamRecordList();
        showPage("examRecord");
    }
    $("#examRecordBack").onclick = () => showPage("home");
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
