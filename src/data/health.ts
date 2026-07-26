/**
 * 계절 재난(폭염·한파)·질병 문구.
 * 알림 문자열은 seasonal.ts가 스케줄/카톡으로 띄우고,
 * SICK_TITLE/SICK_LINES는 renderSickModal이 사용한다.
 * 아이템(에어컨/전기장판) 소유 여부에 따라 SAFE/HIT가 갈린다.
 */

export const HEATWAVE_NOTICE_HIT: string =
  "폭염주의보. 에어컨도 없이 찜통 같은 방에서 하루를 버텼다. 땀이 줄줄, 머리가 멍하다. 아무것도 손에 안 잡힌다.";
export const HEATWAVE_NOTICE_SAFE: string =
  "폭염주의보. 밖은 펄펄 끓지만 에어컨 켜고 시원한 방에서 여유롭게 보냈다. 이 맛에 산다.";

export const COLDWAVE_NOTICE_HIT: string =
  "한파주의보. 전기장판도 없이 이불 뒤집어쓰고 덜덜 떨었다. 손발이 얼어 감각이 없고 몸이 오들오들.";
export const COLDWAVE_NOTICE_SAFE: string =
  "한파주의보. 밖은 살을 에는 추위지만 전기장판에 등 지지며 따뜻하게 넘겼다. 세상 부러울 게 없다.";

/** 카톡 '안전안내문자' 채널에 뜨는 실제 재난문자 투 문구(에어컨/전기장판 소유와 무관하게 동일). */
export const HEATWAVE_ALERT: string =
  "[기상청] 오늘 12시 폭염경보 발효. 낮 최고기온 35도 이상. 물 자주 마시기, 한낮 야외활동 자제, 어르신·어린이 등 건강 유의 바랍니다.";
export const COLDWAVE_ALERT: string =
  "[기상청] 오늘 06시 한파경보 발효. 아침 최저기온 영하 12도 이하. 외출 시 보온 철저, 수도계량기·보일러 동파 대비 바랍니다.";

export const SICK_TITLE: string = "몸살이 났다";
export const SICK_LINES: string[] = [
  "온몸이 쑤시고 열이 오른다. 도저히 일어날 수가 없어 하루 종일 이불 속에서 앓았다.",
  "머리는 지끈, 목은 칼칼. 폰 들 힘조차 없어 그냥 눈 감고 하루를 흘려보냈다.",
  "무리했더니 결국 탈이 났다. 오늘은 아무것도 못 하고 앓아눕는 수밖에 없다.",
];
