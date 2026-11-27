export type ScreenTab = 'home' | 'gigs' | 'venues' | 'log';

export interface HomeKpi {
  전체_공연수: number | string;
  공연장수: number | string;
  다가오는_공연수: number | string;
  단독_비율: number | string;
}

export interface WeekdayStat {
  요일번호: number;
  요일: string;
  공연수: number;
}

export interface HomeData {
  kpi: HomeKpi;
  weekdays: WeekdayStat[];
  todayKst: string;
}

export interface GigItem {
  gig_id: number;
  kopis_id: string | null;
  venue_id: number;
  venue_name: string;
  gig_title: string;
  gig_type: '공연' | '페스티벌';
  gig_date: string;
  end_date: string | null;
  poster_url: string | null;
  bands: string[];
}

export interface UserItem {
  user_id: number;
  nickname: string;
}

export interface VenueVisitItem {
  회원: string;
  공연장: string;
  공연수: number;
  간_횟수: number;
}

export interface MyLogItem {
  attendance_id: number | null;
  gig_id: number | null;
  회원: string;
  날짜: string;
  공연: string;
  공연장: string;
  메모: string;
}

export interface FollowUpcomingItem {
  회원: string;
  날짜: string;
  밴드: string;
  공연: string;
  공연장: string;
}

export interface MyLogData {
  user: UserItem;
  totalCount: number;
  logs: MyLogItem[];
  followUpcoming: FollowUpcomingItem[];
  attendedGigIds: number[];
  todayKst: string;
}

export interface ApiErrorPayload {
  error: string;
  code?: string;
  missing?: string[];
}
