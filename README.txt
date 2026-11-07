Sirius UT static-review page assets — LOCAL PREPARATION ONLY

media/: 최신720p 영상12개. 대표01–11 각1개 + 별도04 햇살 변주1개.
catalog.json: 공개 설명/가상 캐스팅/경험/상대 media 경로/버전. rating 데이터는 전혀 만들지 않았습니다.
대표 선택은 isRepresentative=true && variant=main && isLatest=true 입니다. 변주04는 id=ep04-sunlight, variant=sunlight, isRepresentative=false입니다. 두04는 다른 영상이며 동일 파일을 대표로 중복 사용하지 않습니다.
04 기본은 remake_v3를 보존한 새 로컬 복사본입니다. 3.500–6.600초(105–197프레임)에 검증된 동일 폰 샷의 정렬된 중립 예시 UI만 이식했습니다. 햇살편 전체를 기본본으로 바꿔 끼우지 않았습니다. 다른 장면/대사/음악/총길이는 유지, AAC packet 동일, 전체 디코딩 검증. 기존 원본은 수정하지 않았습니다.
03은 walk_fix_v4입니다. 05는 이미 잘못된 화면예시 고지가 제거된 clean bytes입니다. 07–11은 부모 최종videoReview 통과본입니다.
각 파일720x1280/H264/AAC/faststart, 개별15MB 이하. 영상은 개별 첨부하고 ZIP을 만들지 않습니다. upload_groups.json의2그룹은 각각46,000,000bytes 이하입니다. delivery_manifest.json에는선별파일 path/bytes/SHA256을 기록했고 자체manifest와group파일의 self-hash는 포함하지 않습니다.
공개 페이지에는 licenses/Windswept_CREDITS.txt의 곡명/작가/출처/CC BY4.0 링크/변경사항을 실제 보이는 footer나 크레딧 영역에 표시해야 합니다. JSON/txt만 저장소 안에 두고 표기를 완료했다고 하면 안 됩니다. catalog.json.musicCredits에 그대로 사용할 내용을 넣었습니다. 음악만CCBY4.0이고 영상 전체의 라이선스를 임의로 정하지 않았습니다.
실제 응답자/반려견 이름, 개인 연락처, 원본CSV, 설문 원문, 인증정보를 복사하지 않았습니다. 공개 설명은 가상 캐스팅과 선별 요약만입니다. 나이/성별/견종은 실제 응답자 속성이라고 주장하지 않습니다.
이 폴더는 자산/JSON/TXT 준비물뿐입니다. 사이트 코드 작성, repo clone/push, GitHub 인증 접근, Drive 변경이나 외부 업로드는 수행하지 않았습니다. 검수 이미지/로컬 소스경로/스크립트는 별도work 폴더에 있고 첨부그룹에 포함하지 않습니다.
