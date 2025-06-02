# Stock Price Tracker

A real-time stock price tracking application built with React, TypeScript, and Vite. The application allows users to:

- Track multiple stock prices simultaneously (up to 10 stocks)
- View historical price data
- See price predictions based on technical analysis
- Compare stocks with market indicators

## Features

- Real-time stock data from Alpha Vantage API
- Interactive charts using Chart.js
- Material-UI components for modern UI
- Technical analysis-based price predictions
- Support for multiple stock symbols
- Responsive design

## Technologies Used

- React 18
- TypeScript
- Vite
- Material-UI
- Chart.js
- Alpha Vantage API

## Getting Started

1. Clone the repository:
   ```bash
   git clone [your-repo-url]
   cd stock-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your Alpha Vantage API key:
   ```
   VITE_ALPHA_VANTAGE_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

## Usage

1. Enter a stock symbol (e.g., AAPL, MSFT, GOOGL) in the input field
2. Click "Add Stock" to track the stock
3. View historical prices and predictions in the chart
4. Remove stocks by clicking the "X" on their chips

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

MIT
