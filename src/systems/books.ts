import type { AttributeId, GameState } from "@/core/types";
import type { Book, BookCategory } from "@/data/books";
import { clampResource, clampSkill } from "./stats";
import { addSchedule, advanceTime } from "./time";

/** 책 한 권 감상에 드는 행동력 */
export const BOOK_ACTION_COST = 8;

export interface ReadResult {
  message: string;
}

/**
 * 책을 감상한다(시간 블록 1칸 소모).
 * - 공통: 지식·어휘력이 오른다.
 * - 교양: 지식(정보) 추가 상승 / 소설: 어휘력 추가 상승 / 만화: 창작 추가 상승.
 */
export function readBook(
  state: GameState,
  category: BookCategory,
  title: string,
  bookId?: string,
): ReadResult {
  state.resources.action = Math.max(0, state.resources.action - BOOK_ACTION_COST);
  // 만화책은 '봤던 작품'으로 기록된다(2차창작 대상). 만화 작품 id = 도서 id.
  if (category === "comic" && bookId && !state.seenWorks.includes(bookId)) {
    state.seenWorks.push(bookId);
  }
  // 공통 상승
  state.skills.knowledge = clampSkill(state.skills.knowledge + 10);
  state.skills.vocabulary = clampSkill(state.skills.vocabulary + 10);
  state.resources.mental = clampResource(state.resources.mental + 3);

  let extra: string;
  if (category === "culture") {
    state.skills.knowledge = clampSkill(state.skills.knowledge + 15);
    extra = "지식(정보)";
  } else if (category === "novel") {
    state.skills.vocabulary = clampSkill(state.skills.vocabulary + 15);
    extra = "어휘력";
  } else if (category === "cooking") {
    state.skills.creativity = clampSkill(state.skills.creativity + 15);
    state.skills.knowledge = clampSkill(state.skills.knowledge + 5);
    extra = "요리 감각(창작)";
  } else {
    state.skills.creativity = clampSkill(state.skills.creativity + 20);
    extra = "창작";
  }

  addSchedule(state, `독서: ${title}`, "offline");
  advanceTime(state, 1);
  return {
    message: `『${title}』을(를) 감상했다. 지식·어휘력이 늘었고, ${extra}도 함께 올랐다.`,
  };
}

/** 감상한 책을 트윗할 때의 카테고리(속성) — 교양=정보계, 소설=일상계, 만화=애니덕, 요리=요리계 */
export function bookTweetAttr(category: BookCategory): AttributeId {
  if (category === "comic") return "anime";
  if (category === "culture") return "info";
  if (category === "cooking") return "cooking";
  return "daily";
}

/**
 * 감상한 책에 대한 트윗 문구 후보(책 제목·저자가 들어간 감상평).
 * 종류별로 결이 다른 문장을 만들어, 등록 시 그중 하나가 랜덤으로 뽑힌다.
 */
export function bookTweetLines(book: Book): string[] {
  const t = book.title;
  const a = book.author;
  if (book.category === "culture") {
    return [
      `『${t}』 읽었는데 복잡했던 머릿속이 신기하게 정리되는 기분이라 밑줄만 한가득 그었다 이건 두고두고 곱씹을 책`,
      `${a} 작가의 『${t}』 완독. 교양 한 스푼 제대로 채운 느낌이라 괜히 뿌듯하고 주변에도 추천하고 싶어진다`,
      `『${t}』 읽는 중인데 당연하게 여기던 것들을 다시 보게 만드는 관점이 많아서 페이지가 술술 넘어간다`,
      `요즘 생각이 많았는데 『${t}』 덕분에 실마리를 좀 찾은 것 같다 좋은 책은 역시 만나는 타이밍이 있는 듯`,
      `『${t}』 완독 인증. 어렵지 않을까 걱정했는데 술술 읽히면서도 남는 게 많아서 강력 추천한다`,
    ];
  }
  if (book.category === "cooking") {
    return [
      `『${t}』 보고 그대로 따라 했더니 진짜 실패가 없다 요리 자신감 뿜뿜 🍳`,
      `${a}의 『${t}』 레시피대로 하니 집밥 퀄리티가 확 올라갔다 강력 추천`,
      `『${t}』 덕분에 냉장고 재료로 근사한 한 상 차렸다 이 책은 소장각`,
      `요리 왕초보인데 『${t}』 한 권으로 기본기 다 잡았다 밥이 는다`,
      `『${t}』 펼쳐두고 주말마다 한 가지씩 도전하는 재미가 쏠쏠하다`,
    ];
  }
  if (book.category === "novel") {
    return [
      `『${t}』 마지막 장 덮고 한참 여운에 잠겨 있다 이래서 소설을 못 끊지 오늘 밤은 잠 다 잤네`,
      `${a}의 『${t}』, 다음 이야기가 궁금해서 결국 밤새 읽어버렸다 눈은 아픈데 후회는 없어`,
      `『${t}』 읽는 내내 주인공한테 완전히 몰입해서 같이 울고 웃었다 이런 소설 만나면 그날 하루가 특별해진다`,
      `『${t}』 결말이 계속 머릿속을 맴돌아서 아무것도 손에 안 잡힌다 여운 긴 소설 좋아하면 꼭 읽어봐요`,
      `오랜만에 인생 소설 만났다 『${t}』, 문장 하나하나가 마음에 콕콕 박혀서 몇 번을 다시 읽었는지`,
    ];
  }
  return [
    `『${t}』 정주행 완료 ㅋㅋ 이 맛에 만화 보지 다음 권 언제 나오냐 벌써부터 기다려진다`,
    `${a} 『${t}』 이번 화 전개 미쳤다 손에 땀 쥐고 봤네 이래서 이 작품 못 끊어`,
    `『${t}』 그림체도 스토리도 완전 취향 저격이라 시간 순삭했다 입문작으로 강력 추천`,
    `『${t}』 보는데 캐릭터들이 너무 매력적이라 한 권만 본다는 게 결국 밤을 새워버렸다`,
    `『${t}』 신간 떴길래 바로 봤는데 역시 기대를 안 배신하네 다음 권도 예약 각`,
  ];
}
