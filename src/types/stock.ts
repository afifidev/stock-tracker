export interface StockData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockMetadata {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  timezone: string;
} 