export const SAMPLE_VIBE_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>스피드 수학 퀴즈 챌린지 🧮</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Canvas Confetti CDN -->
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    body {
      font-family: Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
    }
  </style>
</head>
<body class="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 min-h-screen flex items-center justify-center p-4">

  <div class="max-w-md w-full bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-white/40 text-center relative overflow-hidden">
    <!-- 상단 뱃지 -->
    <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold mb-4 tracking-wide">
      <span>🚀</span>
      <span>숏.한국 바이브코딩 호스팅 샘플</span>
    </div>

    <h1 class="text-2xl font-black text-gray-800 mb-1">
      스피드 수학 퀴즈 🧮
    </h1>
    <p class="text-xs text-gray-500 mb-6">
      정답을 맞히고 최고 연속 점수에 도전해보세요!
    </p>

    <!-- 스코어 보드 -->
    <div class="grid grid-cols-2 gap-3 mb-6">
      <div class="bg-indigo-50/80 p-3.5 rounded-2xl border border-indigo-100">
        <div class="text-xs text-indigo-600 font-medium">현재 점수</div>
        <div id="score" class="text-2xl font-black text-indigo-700">0</div>
      </div>
      <div class="bg-pink-50/80 p-3.5 rounded-2xl border border-pink-100">
        <div class="text-xs text-pink-600 font-medium">연속 정답 🔥</div>
        <div id="streak" class="text-2xl font-black text-pink-700">0</div>
      </div>
    </div>

    <!-- 문제 카드 -->
    <div class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg mb-6 transform transition-all duration-300 hover:scale-[1.02]">
      <div class="text-xs font-semibold uppercase tracking-wider text-indigo-200 mb-1">Question</div>
      <div id="problem" class="text-4xl font-black tracking-wider py-2">
        12 + 7 = ?
      </div>
    </div>

    <!-- 입력 폼 -->
    <form id="quiz-form" class="space-y-4">
      <div class="relative">
        <input
          type="number"
          id="user-answer"
          class="w-full px-5 py-4 text-2xl font-bold text-center bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:bg-white focus:outline-none transition-all duration-200"
          placeholder="정답 입력"
          autocomplete="off"
          autofocus
          required
        />
      </div>

      <button
        type="submit"
        class="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-md hover:shadow-xl transition-all duration-200 transform active:scale-95 text-lg"
      >
        정답 확인 ✨
      </button>
    </form>

    <!-- 메시지 피드백 -->
    <div id="feedback" class="mt-4 min-h-[24px] text-sm font-bold transition-all duration-200 text-gray-400">
      문제를 풀고 엔터를 누르세요!
    </div>

    <!-- 푸터 -->
    <div class="mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
      <span>HTML 단일 파일 웹페이지</span>
      <span class="text-indigo-600 font-semibold">숏.한국 호스팅</span>
    </div>
  </div>

  <script>
    let currentAnswer = 0;
    let score = 0;
    let streak = 0;

    const problemEl = document.getElementById('problem');
    const answerInput = document.getElementById('user-answer');
    const scoreEl = document.getElementById('score');
    const streakEl = document.getElementById('streak');
    const feedbackEl = document.getElementById('feedback');
    const form = document.getElementById('quiz-form');

    function generateProblem() {
      const ops = ['+', '-', '×'];
      const op = ops[Math.floor(Math.random() * ops.length)];
      let a, b;

      if (op === '+') {
        a = Math.floor(Math.random() * 50) + 10;
        b = Math.floor(Math.random() * 50) + 1;
        currentAnswer = a + b;
      } else if (op === '-') {
        a = Math.floor(Math.random() * 60) + 20;
        b = Math.floor(Math.random() * a) + 1;
        currentAnswer = a - b;
      } else {
        a = Math.floor(Math.random() * 12) + 2;
        b = Math.floor(Math.random() * 9) + 2;
        currentAnswer = a * b;
      }

      problemEl.innerText = \`\${a} \${op} \${b} = ?\`;
      answerInput.value = '';
      answerInput.focus();
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = parseInt(answerInput.value.trim(), 10);
      if (isNaN(val)) return;

      if (val === currentAnswer) {
        score += 10 + (streak * 2);
        streak += 1;
        feedbackEl.innerText = \`🎉 정답입니다! (+\${10 + ((streak - 1) * 2)}점)\`;
        feedbackEl.className = 'mt-4 min-h-[24px] text-sm font-bold text-emerald-600';

        if (window.confetti) {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.7 }
          });
        }
      } else {
        streak = 0;
        feedbackEl.innerText = \`😢 아쉬워요! 정답은 \${currentAnswer}였습니다.\`;
        feedbackEl.className = 'mt-4 min-h-[24px] text-sm font-bold text-rose-500';
      }

      scoreEl.innerText = score;
      streakEl.innerText = streak;
      generateProblem();
    });

    // 시작
    generateProblem();
  </script>
</body>
</html>`;
