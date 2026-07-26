# Mobile Spectrum Lab v1.0.7

스마트폰으로 촬영한 분광 이미지를 ROI 기반으로 분석하는 연구용 웹앱입니다.

## 주요 기능

- 이미지 업로드 및 고정 크기 ROI 이동
- Gray(FIJI), Red, Green, Blue 채널 분석
- RGB Overlay에서 R/G/B 스펙트럼 동시 표시
- Overlay 채널별 표시/숨김
- Mean, Median, Maximum, Sum 세로 집계
- Blank, Standard, Unknown 측정값 저장
- 저장 기록 클릭 후 그래프와 측정 조건 다시 보기
- 단일 채널 또는 RGB Overlay CSV 내보내기
- 축, 눈금, 범례가 포함된 그래프 PNG 저장
- 프로젝트 JSON 내보내기

## RGB Overlay 데이터

RGB Overlay로 저장하면 Red, Green, Blue 값이 각각 별도의 배열로 보존됩니다. CSV에는 `pixel,red,green,blue` 형식으로 출력됩니다. 화면의 체크박스는 그래프 표시만 바꾸며 원본 R/G/B 측정값은 모두 유지합니다.

## GitHub Pages 업데이트

기존 저장소의 `index.html`, `css`, `js`, `README.md`, `CHANGELOG.md`를 교체하세요. 커밋 후 웹앱 오른쪽 위 버전이 `v1.0.7`인지 확인합니다.
