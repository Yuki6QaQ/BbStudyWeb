let questionList = [];

async function loadQuestions() {
    const res = await fetch(QUESTION_JSON_URL);
    questionList = await res.json();
    return questionList;
}

function getQuestionList() {
    return questionList;
}

function pickOne(mode) {
    const rec = getRecord();
    let pool = [...questionList];

    if (mode === MODE_WRONG) {
        pool = pool.filter(q => {
            const r = rec[q.id];
            return r && r.wrong > 0;
        });

        if (pool.length === 0) {
            return null;
        }

        pool.sort((a, b) => {
            const ra = rec[a.id] || { wrong: 0 };
            const rb = rec[b.id] || { wrong: 0 };
            return rb.wrong - ra.wrong;
        });
    }

    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
}

function getWrongQuestions() {
    const rec = getRecord();

    return questionList
        .filter(q => rec[q.id] && rec[q.id].wrong > 0)
        .sort((a, b) => {
            const ra = rec[a.id] || { wrong: 0 };
            const rb = rec[b.id] || { wrong: 0 };
            return rb.wrong - ra.wrong;
        });
}
