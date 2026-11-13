// Cloudinary 설정 정보
const CLOUDINARY_CLOUD_NAME = 'vsca2sai';
const CLOUDINARY_UPLOAD_PRESET = 'ai-photo';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// 서버 측 Gemini 분석 API 엔드포인트 (API Key는 서버의 GEMINI_API_KEY 환경 변수 사용)
const ANALYZE_API_URL = '/api/analyze';

const photoInput = document.getElementById('photoInput');
const uploadStepView = document.getElementById('uploadStepView');
const uploadDropzone = document.getElementById('uploadDropzone');
const selectBtn = document.getElementById('selectBtn');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const fileBadge = document.getElementById('fileBadge');
const fileNameEl = document.getElementById('fileName');
const changePhotoBtn = document.getElementById('changePhotoBtn');
const uploadLoadingOverlay = document.getElementById('uploadLoadingOverlay');
const loadingOverlayText = document.getElementById('loadingOverlayText');
const previewStatusMsg = document.getElementById('previewStatusMsg');
const analyzeBtn = document.getElementById('analyzeBtn');
const analyzeBtnIcon = document.getElementById('analyzeBtnIcon');
const analyzeBtnText = document.getElementById('analyzeBtnText');
const helperText = document.getElementById('helperText');
const toast = document.getElementById('toast');

// 결과 화면 요소
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');
const oneLineReviewText = document.getElementById('oneLineReviewText');
const moodList = document.getElementById('moodList');
const stylePointBlock = document.getElementById('stylePointBlock');
const stylePointList = document.getElementById('stylePointList');
const hashtagList = document.getElementById('hashtagList');
const copyHashtagsBtn = document.getElementById('copyHashtagsBtn');
const resetTopBtn = document.getElementById('resetTopBtn');
const retryBtn = document.getElementById('retryBtn');

let currentObjectUrl = null;
let uploadedImageUrl = null;
let currentUploadId = 0;
let isAnalyzing = false;
let currentHashtags = [];
let toastTimer = null;

// 토스트 메시지 표시 함수
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// Cloudinary에 이미지 업로드하는 비동기 함수
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || '이미지 업로드에 실패했습니다.');
  }

  const data = await response.json();
  return data.secure_url || data.url;
}

// 업로드 상태에 따른 UI 업데이트
function setUploadingState() {
  uploadedImageUrl = null;
  window.uploadedImageUrl = null;

  analyzeBtn.disabled = true;
  changePhotoBtn.disabled = false;
  analyzeBtnIcon.textContent = '🔮';
  analyzeBtnText.textContent = 'AI로 분석하기';

  loadingOverlayText.textContent = '이미지를 업로드하고 있습니다.';
  uploadLoadingOverlay.classList.remove('hidden');
  fileBadge.textContent = '업로드 중';
  fileBadge.classList.add('is-uploading');
  fileBadge.classList.remove('is-error');

  previewStatusMsg.textContent = '이미지를 업로드하고 있습니다.';
  previewStatusMsg.classList.add('is-uploading');
  previewStatusMsg.classList.remove('is-error');

  helperText.textContent = '이미지를 업로드하고 있습니다.';
}

function setUploadSuccessState(imageUrl) {
  uploadedImageUrl = imageUrl;
  window.uploadedImageUrl = imageUrl;
  previewImage.dataset.cloudinaryUrl = imageUrl;

  uploadLoadingOverlay.classList.add('hidden');
  fileBadge.textContent = '업로드 완료';
  fileBadge.classList.remove('is-uploading', 'is-error');

  previewStatusMsg.textContent = '🎉 사진 업로드 완료! 이제 아래 버튼을 눌러 분위기를 분석해보세요.';
  previewStatusMsg.classList.remove('is-uploading', 'is-error');

  analyzeBtn.disabled = false;
  changePhotoBtn.disabled = false;
  analyzeBtnIcon.textContent = '🔮';
  analyzeBtnText.textContent = 'AI로 분석하기';
  helperText.textContent = '버튼을 누르면 AI가 이 사진의 분위기를 분석해요 ✨';
}

function setUploadErrorState(errorMessage) {
  uploadedImageUrl = null;
  window.uploadedImageUrl = null;

  uploadLoadingOverlay.classList.add('hidden');
  fileBadge.textContent = '업로드 실패';
  fileBadge.classList.remove('is-uploading');
  fileBadge.classList.add('is-error');

  previewStatusMsg.textContent = `⚠️ ${errorMessage} 다시 사진을 선택해주세요.`;
  previewStatusMsg.classList.remove('is-uploading');
  previewStatusMsg.classList.add('is-error');

  analyzeBtn.disabled = true;
  changePhotoBtn.disabled = false;
  helperText.textContent = '다른 사진을 선택하거나 다시 시도해주세요.';
}

// AI 분석 진행 중 UI 상태 업데이트
function setAnalyzingState() {
  isAnalyzing = true;
  analyzeBtn.disabled = true;
  changePhotoBtn.disabled = true;

  analyzeBtnIcon.textContent = '⏳';
  analyzeBtnText.textContent = 'AI가 사진을 분석하고 있습니다.';

  loadingOverlayText.textContent = 'AI가 사진을 분석하고 있습니다.';
  uploadLoadingOverlay.classList.remove('hidden');

  fileBadge.textContent = 'AI 분석 중';
  fileBadge.classList.add('is-uploading');
  fileBadge.classList.remove('is-error');

  previewStatusMsg.textContent = 'AI가 사진을 분석하고 있습니다.';
  previewStatusMsg.classList.add('is-uploading');
  previewStatusMsg.classList.remove('is-error');

  helperText.textContent = 'AI가 사진을 분석하고 있습니다.';
}

// AI 분석 실패 시 UI 복구
function setAnalyzeErrorState(errorMessage) {
  isAnalyzing = false;
  uploadLoadingOverlay.classList.add('hidden');

  fileBadge.textContent = '분석 실패';
  fileBadge.classList.remove('is-uploading');
  fileBadge.classList.add('is-error');

  previewStatusMsg.textContent = `⚠️ ${errorMessage}`;
  previewStatusMsg.classList.remove('is-uploading');
  previewStatusMsg.classList.add('is-error');

  analyzeBtn.disabled = false;
  changePhotoBtn.disabled = false;
  analyzeBtnIcon.textContent = '🔮';
  analyzeBtnText.textContent = '다시 AI로 분석하기';
  helperText.textContent = '잠시 후 다시 버튼을 눌러 분석을 시도해보세요.';
}

// 분석 결과 렌더링 및 결과 화면으로 전환
function renderAnalysisResult(data) {
  isAnalyzing = false;
  uploadLoadingOverlay.classList.add('hidden');

  // 결과 사진 표시 (로컬 미리보기 우선, 없으면 Cloudinary URL)
  resultImage.src = currentObjectUrl || data.imageUrl || uploadedImageUrl;

  // 1. AI 한줄평
  oneLineReviewText.textContent = data.oneLineReview || '감성 가득한 분위기가 돋보이는 멋진 사진이에요!';

  // 2. 분위기 키워드 3개 & 재미있게 표현한 퍼센트
  moodList.innerHTML = '';
  const moods = Array.isArray(data.moods) ? data.moods.slice(0, 3) : [];
  moods.forEach((item) => {
    const percentValue = Math.max(0, Math.min(100, Number(item.percentage) || 0));
    const moodItem = document.createElement('div');
    moodItem.className = 'mood-item';

    const topRow = document.createElement('div');
    topRow.className = 'mood-item-top';

    const keywordWrap = document.createElement('div');
    keywordWrap.className = 'mood-keyword-wrap';

    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'mood-emoji';
    emojiSpan.textContent = item.emoji || '✨';

    const keywordSpan = document.createElement('span');
    keywordSpan.className = 'mood-keyword';
    keywordSpan.textContent = item.keyword || '감성 무드';

    keywordWrap.appendChild(emojiSpan);
    keywordWrap.appendChild(keywordSpan);

    const percentBadge = document.createElement('span');
    percentBadge.className = 'mood-percent-badge';
    percentBadge.textContent = `${percentValue}%`;

    topRow.appendChild(keywordWrap);
    topRow.appendChild(percentBadge);

    const wittyLabel = document.createElement('p');
    wittyLabel.className = 'mood-witty-label';
    wittyLabel.textContent = `${item.wittyLabel || '사진을 가득 채운 매력 지수'} (${percentValue}%)`;

    const barTrack = document.createElement('div');
    barTrack.className = 'mood-bar-track';

    const barFill = document.createElement('div');
    barFill.className = 'mood-bar-fill';
    barFill.style.width = '0%';

    barTrack.appendChild(barFill);

    moodItem.appendChild(topRow);
    moodItem.appendChild(wittyLabel);
    moodItem.appendChild(barTrack);
    moodList.appendChild(moodItem);

    // 퍼센트 바 애니메이션 적용
    requestAnimationFrame(() => {
      setTimeout(() => {
        barFill.style.width = `${percentValue}%`;
      }, 60);
    });
  });

  // 3. 색상·배경·의상·표정·구도 시각적 스타일 포인트
  stylePointList.innerHTML = '';
  const stylePoints = Array.isArray(data.stylePoints) ? data.stylePoints : [];
  if (stylePoints.length > 0) {
    stylePointBlock.classList.remove('hidden');
    stylePoints.forEach((point) => {
      const li = document.createElement('li');
      li.className = 'style-point-item';
      li.textContent = point;
      stylePointList.appendChild(li);
    });
  } else {
    stylePointBlock.classList.add('hidden');
  }

  // 4. 어울리는 해시태그 4개
  hashtagList.innerHTML = '';
  currentHashtags = Array.isArray(data.hashtags) ? data.hashtags.slice(0, 4) : [];
  currentHashtags.forEach((tag) => {
    const formattedTag = tag.startsWith('#') ? tag : `#${tag}`;
    const chip = document.createElement('span');
    chip.className = 'hashtag-chip';
    chip.textContent = formattedTag;
    hashtagList.appendChild(chip);
  });

  // 업로드/미리보기 화면을 숨기고 결과 화면 표시
  uploadStepView.classList.add('hidden');
  resultSection.classList.remove('hidden');

  // 화면 상단으로 부드럽게 스크롤
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 이미지 파일 처리, 미리보기 표시 및 Cloudinary 업로드 실행
async function handleImageFile(file) {
  if (!file || isAnalyzing) return;

  if (!file.type.startsWith('image/')) {
    showToast('⚠️ 이미지 파일(JPG, PNG 등)만 선택할 수 있어요!');
    return;
  }

  // 이전 미리보기 URL 메모리 해제
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }

  currentObjectUrl = URL.createObjectURL(file);
  previewImage.src = currentObjectUrl;
  fileNameEl.textContent = file.name;

  // 화면 전환: 결과 화면 숨기고 미리보기 표시
  resultSection.classList.add('hidden');
  uploadStepView.classList.remove('hidden');
  uploadDropzone.classList.add('hidden');
  previewSection.classList.remove('hidden');

  // 업로드 중 상태로 UI 전환
  const uploadId = ++currentUploadId;
  setUploadingState();

  try {
    const imageUrl = await uploadToCloudinary(file);

    // 업로드 도중 사용자가 다른 사진을 선택한 경우 이전 요청 무시
    if (uploadId !== currentUploadId) return;

    setUploadSuccessState(imageUrl);
    showToast('✅ 이미지가 성공적으로 업로드되었어요!');
  } catch (error) {
    if (uploadId !== currentUploadId) return;

    console.error('Cloudinary Upload Error:', error);
    setUploadErrorState(error.message || '업로드 중 오류가 발생했어요.');
    showToast('⚠️ 이미지 업로드에 실패했습니다.');
  }
}

// 서버(/api/analyze)를 호출하여 Gemini API로 사진 분위기 분석
async function proceedToAnalysis(imageUrl) {
  if (!imageUrl) {
    showToast('⚠️ 먼저 이미지를 업로드해주세요!');
    return;
  }

  if (isAnalyzing) return;

  setAnalyzingState();

  try {
    const response = await fetch(ANALYZE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'AI 사진 분석 중 오류가 발생했습니다.');
    }

    renderAnalysisResult(data);
    showToast('✨ AI 사진 분위기 분석이 완료되었어요!');
  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    setAnalyzeErrorState(error.message || 'AI 분석 요청에 실패했습니다.');
    showToast('⚠️ AI 분석에 실패했습니다. 다시 시도해주세요.');
  }
}

// 초기 업로드 화면으로 리셋하거나 새 파일 선택
function resetToUploadScreen() {
  if (isAnalyzing) return;
  photoInput.value = '';
  resultSection.classList.add('hidden');
  uploadStepView.classList.remove('hidden');
  openFilePicker();
}

// 파일 선택창 열기
function openFilePicker() {
  if (isAnalyzing) return;
  photoInput.click();
}

// 클릭 이벤트 연결
uploadDropzone.addEventListener('click', (e) => {
  if (e.target === selectBtn) return;
  openFilePicker();
});

selectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openFilePicker();
});

changePhotoBtn.addEventListener('click', () => {
  photoInput.value = '';
  openFilePicker();
});

resetTopBtn.addEventListener('click', resetToUploadScreen);
retryBtn.addEventListener('click', resetToUploadScreen);

// 해시태그 복사하기 버튼
copyHashtagsBtn.addEventListener('click', async () => {
  if (!currentHashtags.length) return;
  const textToCopy = currentHashtags
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .join(' ');

  try {
    await navigator.clipboard.writeText(textToCopy);
    showToast('📋 해시태그 4개가 클립보드에 복사되었어요!');
  } catch {
    showToast('⚠️ 클립보드 복사에 실패했습니다.');
  }
});

// 키보드 접근성 (Enter / Space)
uploadDropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openFilePicker();
  }
});

// 파일 입력 변경 감지
photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  handleImageFile(file);
});

// 드래그 앤 드롭 지원 (PC 환경)
uploadDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadDropzone.classList.add('drag-over');
});

uploadDropzone.addEventListener('dragleave', () => {
  uploadDropzone.classList.remove('drag-over');
});

uploadDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadDropzone.classList.remove('drag-over');

  const file = e.dataTransfer.files[0];
  handleImageFile(file);
});

// 'AI로 분석하기' 버튼 클릭
analyzeBtn.addEventListener('click', () => {
  proceedToAnalysis(uploadedImageUrl);
});
