import axios from 'axios';
import type { StockData, StockMetadata } from '../types/stock';

const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || 'B359U0P5DATQBEVV';
const BASE_URL = 'https://www.alphavantage.co/query';

// Reduced correlation symbols to stay within rate limits
const CORRELATION_SYMBOLS = ['SPY', 'QQQ'];

// Helper function to validate API response
const validateApiResponse = (data: any, symbol: string): boolean => {
  // Log the response for debugging
  console.log(`API Response for ${symbol}:`, JSON.stringify(data, null, 2));

  if (data['Error Message']) {
    throw new Error(`API Error: ${data['Error Message']}`);
  }
  
  if (data['Note']) {
    throw new Error('API rate limit reached. Please try again in a minute.');
  }

  // Check for information message (sometimes sent when symbol is invalid)
  if (data['Information']) {
    throw new Error(`API Information: ${data['Information']}`);
  }

  // More specific validation
  if (!data['Meta Data']) {
    throw new Error(`Invalid symbol or API error for ${symbol}. Please check the symbol and try again.`);
  }

  if (!data['Time Series (Daily)'] || Object.keys(data['Time Series (Daily)']).length === 0) {
    throw new Error(`No daily time series data available for ${symbol}`);
  }

  return true;
};

// Helper function to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getStockData = async (symbol: string): Promise<{
  data: StockData[];
  metadata: StockMetadata;
  predictions: { date: string; price: number }[];
}> => {
  try {
    // Validate symbol format
    if (!symbol.match(/^[A-Z0-9.]+$/)) {
      throw new Error('Invalid symbol format. Please use only letters, numbers, and dots.');
    }

    // Fetch target stock data
    console.log(`Fetching data for ${symbol}...`);
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol,
        apikey: API_KEY,
        outputsize: 'compact'
      }
    });

    // Validate main stock response
    validateApiResponse(response.data, symbol);

    // Process the main stock data first
    const metadata: StockMetadata = {
      symbol: response.data['Meta Data']['2. Symbol'],
      name: '', // Alpha Vantage doesn't provide company name in this endpoint
      currency: 'USD',
      exchange: response.data['Meta Data']['3. Last Refreshed'],
      timezone: response.data['Meta Data']['5. Time Zone'],
    };

    const timeSeriesData = response.data['Time Series (Daily)'];
    const stockData: StockData[] = Object.entries(timeSeriesData)
      .map(([date, values]: [string, any]) => ({
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseFloat(values['5. volume']),
      }))
      .filter(data => !isNaN(data.close)); // Filter out any invalid data points

    if (stockData.length === 0) {
      throw new Error(`No valid price data found for ${symbol}`);
    }

    // Sort data by date (oldest to newest)
    stockData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Fetch correlation data sequentially with delays
    const correlationData: number[][] = [];
    
    for (const corrSymbol of CORRELATION_SYMBOLS) {
      try {
        console.log(`Fetching correlation data for ${corrSymbol}...`);
        await delay(1500); // Wait 1.5 seconds between calls
        
        const corrResponse = await axios.get(BASE_URL, {
          params: {
            function: 'TIME_SERIES_DAILY',
            symbol: corrSymbol,
            apikey: API_KEY,
            outputsize: 'compact'
          }
        });

        validateApiResponse(corrResponse.data, corrSymbol);

        const timeSeries = corrResponse.data['Time Series (Daily)'];
        const prices = Object.values(timeSeries)
          .map((values: any) => parseFloat(values['4. close']))
          .filter((price: number) => !isNaN(price))
          .reverse();

        if (prices.length > 0) {
          correlationData.push(prices);
        }
      } catch (error) {
        console.warn(`Failed to fetch correlation data for ${corrSymbol}:`, error);
        // Continue with other symbols if one fails
      }
    }

    // Extract price arrays for prediction
    const targetPrices = stockData.map(d => d.close);

    // Generate predictions even if correlation data is partially missing
    const predictions = predictFuturePrices(
      targetPrices,
      correlationData[0] || targetPrices, // Fallback to target prices if SPY data is missing
      5
    );

    // Generate dates for predictions
    const lastDate = new Date(stockData[stockData.length - 1].date);
    const predictionDates = predictions.map((price, index) => {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + index + 1);
      return {
        date: date.toISOString().split('T')[0],
        price
      };
    });

    return { data: stockData, metadata, predictions: predictionDates };
  } catch (error) {
    console.error('Error in getStockData:', error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('An unexpected error occurred while fetching stock data');
  }
};

// Calculate correlation coefficient between two arrays
export function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = x[i] - xMean;
    const yDiff = y[i] - yMean;
    numerator += xDiff * yDiff;
    xVariance += xDiff * xDiff;
    yVariance += yDiff * yDiff;
  }

  return numerator / Math.sqrt(xVariance * yVariance);
}

// Calculate daily returns
function calculateReturns(prices: number[]): number[] {
  return prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
}

// Calculate volatility using returns
function calculateVolatility(prices: number[], window: number = 20): number {
  const returns = calculateReturns(prices.slice(-window));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

// Calculate RSI (Relative Strength Index)
function calculateRSI(prices: number[], period: number = 14): number {
  const changes = prices.slice(-period - 1).map((price, i, arr) => 
    i > 0 ? price - arr[i - 1] : 0
  ).slice(1);
  
  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? -change : 0);

  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) return 70; // Changed from 100 to be more realistic
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate moving average
export function calculateMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

// Calculate price momentum
function calculateMomentum(prices: number[], period: number = 10): number {
  if (prices.length < period) return 0;
  const recentPrices = prices.slice(-period);
  const returns = calculateReturns(recentPrices);
  return returns.reduce((a, b) => a + b, 0) / returns.length;
}

// Mean reversion signal (-1 to 1)
function calculateMeanReversionSignal(price: number, ma20: number, ma50: number): number {
  const shortTermDev = (price - ma20) / ma20;
  const longTermDev = (price - ma50) / ma50;
  return -(shortTermDev + longTermDev) / 2; // Negative sign for mean reversion
}

// Predict future prices using multiple factors
export function predictFuturePrices(
  targetPrices: number[],
  spyPrices: number[],
  daysToPredict: number
): number[] {
  if (targetPrices.length < 50) return [];

  const volatility = calculateVolatility(targetPrices);
  const rsi = calculateRSI(targetPrices);
  const momentum = calculateMomentum(targetPrices);
  const ma20 = calculateMA(targetPrices, 20);
  const ma50 = calculateMA(targetPrices, 50);

  // Market correlation
  const spyReturns = calculateReturns(spyPrices.slice(-20));
  const stockReturns = calculateReturns(targetPrices.slice(-20));
  const correlation = calculateCorrelation(spyReturns, stockReturns);

  // Recent market trend
  const recentSpyReturn = (spyPrices[spyPrices.length - 1] - spyPrices[spyPrices.length - 2]) / spyPrices[spyPrices.length - 2];

  const predictions: number[] = [];
  let currentPrice = targetPrices[targetPrices.length - 1];

  for (let i = 1; i <= daysToPredict; i++) {
    // Mean reversion component
    const meanReversionSignal = calculateMeanReversionSignal(
      currentPrice,
      ma20[ma20.length - 1],
      ma50[ma50.length - 1]
    );

    // RSI component (-1 to 1 scale)
    const rsiSignal = (50 - rsi) / 50;

    // Market influence
    const marketInfluence = recentSpyReturn * correlation;

    // Momentum decay
    const momentumEffect = momentum * Math.exp(-0.5 * i);

    // Combine signals with weights
    const expectedReturn = (
      meanReversionSignal * 0.3 +    // 30% mean reversion
      rsiSignal * 0.2 +              // 20% RSI
      marketInfluence * 0.3 +        // 30% market influence
      momentumEffect * 0.2           // 20% momentum
    );

    // Add volatility-based random component
    const randomComponent = volatility * (Math.random() - 0.5) * Math.sqrt(i);
    const totalReturn = expectedReturn + randomComponent;

    // Calculate new price with dampening factor for longer predictions
    const dampening = Math.exp(-0.1 * i);
    const change = totalReturn * volatility * dampening;
    
    // Ensure realistic daily change
    const maxChange = Math.min(0.1, volatility * 2);
    const boundedChange = Math.max(-maxChange, Math.min(maxChange, change));
    
    // Update current price
    currentPrice = currentPrice * (1 + boundedChange);
    predictions.push(Number(currentPrice.toFixed(2)));
  }

  return predictions;
} 