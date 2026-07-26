# Changelog

## v1.0.1

- ROI 오버레이가 원본 픽셀값에 섞이던 오류 수정
- 원본 이미지 전용 offscreen canvas에서 스펙트럼 추출
- FIJI 방식 Gray 변환(0.299R + 0.587G + 0.114B) 추가 및 기본값 설정
- Red, Green, Blue, Mean RGB 채널 선택 추가
- 세로 방향 Mean, Median, Maximum, Sum 집계 분리
- 그래프 Y축을 0–255로 고정(합계 모드는 자동 범위)
- 현재 스펙트럼 CSV 내보내기 추가
- 새 프로젝트의 초기 ROI 가로폭을 이미지 너비의 22%로 설정

## v1.0.0-alpha

- 프로젝트 생성 및 브라우저 저장
- 사진 촬영/불러오기
- ROI 이동 및 크기 조절
- 스펙트럼 추출
- Blank/Standard/Unknown 저장
- JSON 내보내기
