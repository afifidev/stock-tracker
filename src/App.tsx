import { useState } from 'react'
import { TextField, Button, Container, Box, Typography, CircularProgress, Chip } from '@mui/material'
import { StockChart } from './components/StockChart'
import { getStockData } from './services/stockService'
import type { StockData, StockMetadata } from './types/stock'

interface StockEntry {
  symbol: string;
  data: StockData[];
  metadata: StockMetadata;
  predictions: { date: string; price: number }[];
}

const MAX_STOCKS = 10;

function App() {
  const [symbol, setSymbol] = useState('')
  const [stocks, setStocks] = useState<StockEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!symbol) return
    
    // Check if we already have max stocks
    if (stocks.length >= MAX_STOCKS) {
      setError(`Maximum of ${MAX_STOCKS} stocks allowed. Remove some stocks to add new ones.`)
      return
    }

    // Check if stock is already added
    if (stocks.some(stock => stock.symbol === symbol.toUpperCase())) {
      setError('This stock is already added to the chart.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await getStockData(symbol.toUpperCase())
      setStocks(prev => [...prev, {
        symbol: symbol.toUpperCase(),
        data: result.data,
        metadata: result.metadata,
        predictions: result.predictions
      }])
      setSymbol('') // Clear input after successful add
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error fetching stock data. Please try again.');
      }
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveStock = (symbolToRemove: string) => {
    setStocks(prev => prev.filter(stock => stock.symbol !== symbolToRemove))
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Stock Price Tracker
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label="Stock Symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Enter stock symbol (e.g., AAPL)"
              variant="outlined"
              size="small"
            />
            <Button
              type="submit"
              variant="contained"
              disabled={!symbol || loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Add Stock'}
            </Button>
            <Typography variant="body2" color="text.secondary">
              {stocks.length}/{MAX_STOCKS} stocks added
            </Typography>
          </Box>
        </Box>

        {error && (
          <Typography color="error" align="center" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}

        {stocks.length > 0 && (
          <Box sx={{ mt: 3, display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {stocks.map((stock) => (
              <Chip
                key={stock.symbol}
                label={`${stock.symbol} - ${stock.metadata.exchange}`}
                onDelete={() => handleRemoveStock(stock.symbol)}
                sx={{ m: 0.5 }}
              />
            ))}
          </Box>
        )}

        {stocks.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <StockChart stocks={stocks} />
          </Box>
        )}
      </Box>
    </Container>
  )
}

export default App
