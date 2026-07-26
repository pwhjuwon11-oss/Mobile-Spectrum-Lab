# Mobile Spectrum Lab v1.0.0-alpha

스마트폰에서 스펙트럼 사진을 불러오고, ROI를 설정하여 회색조 스펙트럼을 추출하는 첫 번째 실행 버전입니다.

## 실행 방법
1. 폴더 전체를 GitHub 저장소에 업로드합니다.
2. GitHub Pages에서 배포합니다.
3. 스마트폰으로 배포 주소를 엽니다.
4. `카메라 촬영` 또는 `사진 불러오기`를 누릅니다.

## 구현된 기능
- 프로젝트 생성 및 브라우저 저장
- 스마트폰 카메라/갤러리 입력
- ROI 이동 및 크기 조절
- ROI 폭·높이 잠금
- 실시간 스펙트럼 추출
- Mean / Median / Maximum / Sum 모드
- Blank / Standard / Unknown 저장
- 재질별 자동 번호
- Current Session 집계
- JSON 내보내기

## 주의
- 현재는 `Raw Spectrum`만 저장합니다.
- Blank 보정, I/I0, 1-I/I0, 정규화, MAD는 Step 2에서 추가합니다.
- 브라우저 저장소(localStorage)를 사용하므로 브라우저 데이터를 삭제하면 앱 내부 데이터도 삭제됩니다. 중요한 데이터는 JSON으로 내보내세요.
