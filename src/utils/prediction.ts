interface DataPoint {
  x: number;
  y: number;
}

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
  correlatedStocksPrices: number[][],
  daysToPredict: number
): number[] {
  if (targetPrices.length < 50) return [];

  const recentPrices = targetPrices.slice(-50);
  const lastPrice = recentPrices[recentPrices.length - 1];
  
  // Calculate technical indicators
  const volatility = calculateVolatility(recentPrices);
  const rsi = calculateRSI(recentPrices);
  const momentum = calculateMomentum(recentPrices);
  const ma20 = calculateMA(recentPrices, 20);
  const ma50 = calculateMA(recentPrices, 50);

  // Market correlation
  const spyReturns = calculateReturns(spyPrices.slice(-20));
  const stockReturns = calculateReturns(recentPrices.slice(-20));
  const correlation = calculateCorrelation(spyReturns, stockReturns);

  // Recent market trend
  const recentSpyReturn = (spyPrices[spyPrices.length - 1] - spyPrices[spyPrices.length - 2]) / spyPrices[spyPrices.length - 2];

  const predictions: number[] = [];
  let currentPrice = lastPrice;

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