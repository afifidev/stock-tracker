import axios from 'axios';
import type { StockData, StockMetadata } from '../types/stock';
import { predictFuturePrices } from '../utils/prediction';

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
      correlationData.slice(1),
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