import type { ErrorCode } from '@shared/events';

/** Server error codes plus the two the client produces itself. */
export type ClientError =
  | ErrorCode
  /** A room action was attempted before the rejoin finished. Nothing was sent. */
  | 'NOT_READY'
  /** The request couldn't be sent or wasn't acknowledged. */
  | 'CONNECTION';

const MESSAGES: Record<ClientError, string> = {
  ROOM_NOT_FOUND: 'Bu oda bulunamadı. Süresi dolmuş olabilir.',
  ROOM_FULL: 'Oda dolu. Bir odada en fazla 12 kişi olabilir.',
  SERVER_FULL: 'Şu an çok fazla oda açık. Birkaç dakika sonra tekrar dene.',
  RATE_LIMITED: 'Kısa sürede çok fazla oda oluşturdun. Bir dakika sonra tekrar dene.',
  SESSION_EXPIRED: 'Oturumun sona ermiş. Adını yazıp yeniden katılabilirsin.',
  NAME_TAKEN: 'Bu isim odada zaten var. Başka bir isim dene.',
  INVALID_INPUT: 'Bir şeyler ters gitti. Lütfen tekrar dene.',
  NOT_HOST: 'Bunu yalnızca ev sahibi yapabilir.',
  WRONG_PHASE: 'Oda bir sonraki adıma geçmiş. Ekran güncellendi.',
  NOT_A_VOTER: 'Bu turu izliyorsun. Bir sonraki turda oy verebilirsin.',
  ALREADY_VOTED: 'Oyların zaten alınmış.',
  INVALID_BALLOT: 'Oyların eksik görünüyor. Lütfen tekrar gönder.',
  NO_BALLOTS: 'Henüz kimse oy vermedi.',
  TOO_FEW_CANDIDATES: 'Oylamayı başlatmak için en az 2 film seç.',
  TOO_MANY_CANDIDATES: 'En fazla 12 film ekleyebilirsin.',
  DUPLICATE_CANDIDATE: 'Bu film listede zaten var.',
  NOT_READY: 'Bağlantı yeniden kuruluyor. Birazdan tekrar dene.',
  CONNECTION: 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.',
};

export function errorMessage(error: ClientError): string {
  return MESSAGES[error];
}
