import { Line } from 'react-chartjs-2';
import { useState, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { StockData, StockMetadata } from '../types/stock';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface StockEntry {
  symbol: string;
  data: StockData[];
  metadata: StockMetadata;
  predictions: { date: string; price: number }[];
}

interface StockChartProps {
  stocks: StockEntry[];
}

const CHART_COLORS = [
  'rgb(75, 192, 192)',    // Teal
  'rgb(255, 99, 132)',    // Pink
  'rgb(255, 205, 86)',    // Yellow
  'rgb(54, 162, 235)',    // Blue
  'rgb(153, 102, 255)',   // Purple
  'rgb(255, 159, 64)',    // Orange
  'rgb(46, 204, 113)',    // Green
  'rgb(231, 76, 60)',     // Red
  'rgb(52, 152, 219)',    // Light Blue
  'rgb(155, 89, 182)',    // Violet
];

export const StockChart = ({ stocks }: StockChartProps) => {
  const [height, setHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      const deltaY = e.clientY - startYRef.current;
      const newHeight = Math.max(400, Math.min(1200, startHeightRef.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    document.body.style.cursor = 'row-resize';
  };

  // Find the common date range
  const allDates = new Set<string>();
  stocks.forEach(stock => {
    stock.data.forEach(item => allDates.add(item.date));
    stock.predictions.forEach(pred => allDates.add(pred.date));
  });

  // Sort dates in ascending order
  const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const chartData = {
    labels: sortedDates,
    datasets: stocks.flatMap((stock, index) => {
      // Create maps for historical and prediction data
      const historicalMap = new Map(stock.data.map(item => [item.date, item.close]));
      const predictionMap = new Map(stock.predictions.map(item => [item.date, item.price]));
      
      // Historical data dataset
      const historicalDataset = {
        label: stock.symbol,
        data: sortedDates.map(date => historicalMap.get(date) || null),
        borderColor: CHART_COLORS[index % CHART_COLORS.length],
        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
        tension: 0.1,
        pointRadius: 1.5,
        borderWidth: 2,
      };

      // Prediction dataset
      const predictionDataset = {
        label: `${stock.symbol} Prediction`,
        data: sortedDates.map(date => predictionMap.get(date) || null),
        borderColor: CHART_COLORS[index % CHART_COLORS.length],
        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
        borderDash: [5, 5],
        tension: 0.1,
        pointRadius: 3,
        borderWidth: 2,
      };

      return [historicalDataset, predictionDataset];
    }),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 20,
          padding: 10,
          filter: (item: any) => !item.text.includes('Prediction') || item.text.includes(stocks[0].symbol),
        },
      },
      title: {
        display: true,
        text: 'Stock Price History & Predictions',
        font: {
          size: 16
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y?.toFixed(2) || 'N/A';
            return `${label}: $${value}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Price (USD)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date'
        }
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <div style={{ width: '100%', height: `${height}px`, position: 'relative' }}>
        <Line data={chartData} options={options} />
      </div>
      <div
        style={{
          width: '100%',
          height: '10px',
          backgroundColor: '#f0f0f0',
          cursor: 'row-resize',
          borderRadius: '0 0 4px 4px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onMouseDown={handleMouseDown}
      >
        <div
          style={{
            width: '50px',
            height: '4px',
            backgroundColor: '#ccc',
            borderRadius: '2px'
          }}
        />
      </div>
    </div>
  );
}; 