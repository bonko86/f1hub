export interface Session { name: string; kind?: string; date: string; start: string | null }
export interface Race { season: number; round: number; name: string; circuit: string; latitude?: number; longitude?: number; country: string; locality: string; date: string; start: string | null; sessions: Session[] }
export interface Standing { position: number; name: string; code?: string; nationality?: string; team: string; teamIds?: string[]; points: string; wins: number }
export interface Dashboard { calendar: Race[]; completedRounds: number[]; calendarSeason: number; seasonRaceCount?: number; loading: boolean; season: number; race: Race | null; status: 'upcoming' | 'awaiting-results' | 'season-ended' | 'unavailable'; drivers: Standing[]; constructors: Standing[]; updated: Record<string, string>; errors: string[]; standingsRound: { drivers: number | null; constructors: number | null } }
export interface LiveRow {
  position: number; code: string; team: string;
  gapToLeader: string | null; interval: string | null; lastLap: string | null;
  driverStatus: 'running' | 'pit' | 'pit-out' | 'retired' | 'stopped';
}
export interface LiveRace {
  status: 'live' | 'waiting' | 'stale' | 'offline'; updatedAt: string | null; raceName: string | null;
  currentLap?: number | null; totalLaps?: number | null;
  sessionPhase?: 'racing' | 'suspended' | null;
  trackStatus?: 'green' | 'yellow' | 'safety-car' | 'red' | 'vsc' | 'vsc-ending' | 'unknown';
  rows: LiveRow[];
  messages?: { id: string; time: string | null; lap: number | null; text: string }[];
  tyres?: { code: string; position: number; stints: TyreStint[] }[];
  battles?: { ahead: string; behind: string; position: number; gap: number; change: number | null; windowSeconds: number | null }[];
}
export interface TyreStint { number: number; compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET' | 'UNKNOWN'; laps: number | null; newTyres: boolean | null }
