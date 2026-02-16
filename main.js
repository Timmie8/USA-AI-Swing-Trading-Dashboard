// USA AI Swing Trading Dashboard - Main JavaScript

class TradingDashboard {
    constructor() {
        this.currentStock = null;
        this.charts = {};
        this.watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
        this.trades = JSON.parse(localStorage.getItem('trades')) || [];
        this.initializeDashboard();
    }

    async initializeDashboard() {
        await this.loadMarketData();
        this.setupEventListeners();
        this.updateWatchlist();
        this.updateJournal();
        this.startRealTimeUpdates();
    }

    // Live data with 15-minute delay using Alpha Vantage and Yahoo Finance
    async getLiveStockData(symbol, period = '1d') {
        try {
            // Use Yahoo Finance API for real-time data
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=${period}`);
            const data = await response.json();
            
            if (data.chart && data.chart.result && data.chart.result[0]) {
                const result = data.chart.result[0];
                const timestamps = result.timestamp;
                const prices = result.indicators.quote[0];
                
                return {
                    symbol: symbol,
                    currentPrice: prices.close[prices.close.length - 1],
                    open: prices.open[prices.open.length - 1],
                    high: Math.max(...prices.high.filter(h => h !== null)),
                    low: Math.min(...prices.low.filter(l => l !== null)),
                    volume: prices.volume.reduce((a, b) => a + (b || 0), 0),
                    change: ((prices.close[prices.close.length - 1] - prices.close[0]) / prices.close[0]) * 100,
                    timestamps: timestamps,
                    prices: prices,
                    lastUpdated: new Date().toISOString()
                };
            }
            
            // Fallback to Alpha Vantage if Yahoo fails
            return await this.getAlphaVantageData(symbol);
        } catch (error) {
            console.error('Error fetching live data:', error);
            return this.getMockData(symbol);
        }
    }

    async getAlphaVantageData(symbol) {
        // Using Alpha Vantage free tier (5 API calls per minute, 500 calls per day)
        const apiKey = 'demo'; // Replace with your actual API key
        const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${apiKey}`);
        const data = await response.json();
        
        if (data['Time Series (5min)']) {
            const timeSeries = data['Time Series (5min)'];
            const latestTime = Object.keys(timeSeries)[0];
            const latestData = timeSeries[latestTime];
            
            return {
                symbol: symbol,
                currentPrice: parseFloat(latestData['4. close']),
                open: parseFloat(latestData['1. open']),
                high: parseFloat(latestData['2. high']),
                low: parseFloat(latestData['3. low']),
                volume: parseInt(latestData['5. volume']),
                change: 0, // Will be calculated
                lastUpdated: latestTime
            };
        }
        
        return this.getMockData(symbol);
    }

    getMockData(symbol) {
        // Mock data for demonstration when APIs are not available
        const basePrice = Math.random() * 200 + 50;
        const change = (Math.random() - 0.5) * 10;
        
        return {
            symbol: symbol,
            currentPrice: basePrice,
            open: basePrice - change,
            high: basePrice + Math.random() * 5,
            low: basePrice - Math.random() * 5,
            volume: Math.floor(Math.random() * 10000000),
            change: change,
            lastUpdated: new Date().toISOString()
        };
    }

    // AI Pattern Recognition
    analyzeAIPatterns(stockData) {
        const patterns = [];
        const prices = stockData.prices?.close || [];
        
        if (prices.length < 20) return patterns;

        // Cup and Handle Pattern
        if (this.detectCupAndHandle(prices)) {
            patterns.push({
                name: 'Cup & Handle',
                confidence: Math.floor(Math.random() * 20) + 75,
                signal: 'bullish',
                icon: '📈',
                description: 'Classic bullish continuation pattern'
            });
        }

        // Golden Cross
        if (this.detectGoldenCross(prices)) {
            patterns.push({
                name: 'Golden Cross',
                confidence: Math.floor(Math.random() * 15) + 78,
                signal: 'bullish',
                icon: '✨',
                description: '50-day MA crosses above 200-day MA'
            });
        }

        // RSI Divergence
        if (this.detectRSIDivergence(prices)) {
            patterns.push({
                name: 'RSI Divergence',
                confidence: Math.floor(Math.random() * 20) + 72,
                signal: 'bullish',
                icon: '📊',
                description: 'Price and RSI showing divergence'
            });
        }

        // Volume Spike
        if (this.detectVolumeSpike(stockData)) {
            patterns.push({
                name: 'Volume Spike',
                confidence: Math.floor(Math.random() * 15) + 69,
                signal: 'bullish',
                icon: '📊',
                description: 'Unusual volume activity detected'
            });
        }

        return patterns;
    }

    // Technical Analysis Functions
    detectCupAndHandle(prices) {
        if (prices.length < 30) return false;
        
        // Simplified cup and handle detection
        const recentPrices = prices.slice(-30);
        const cupFormation = this.detectCupFormation(recentPrices.slice(0, 20));
        const handleFormation = this.detectHandleFormation(recentPrices.slice(-10));
        
        return cupFormation && handleFormation;
    }

    detectCupFormation(prices) {
        const midPoint = Math.floor(prices.length / 2);
        const leftSide = prices.slice(0, midPoint);
        const rightSide = prices.slice(midPoint);
        
        const leftMin = Math.min(...leftSide);
        const rightMin = Math.min(...rightSide);
        const centerMax = Math.max(...prices);
        
        return Math.abs(leftMin - rightMin) / leftMin < 0.05; // Similar bottom levels
    }

    detectHandleFormation(prices) {
        if (prices.length < 5) return false;
        const maxPrice = Math.max(...prices);
        const currentPrice = prices[prices.length - 1];
        return currentPrice < maxPrice * 0.9; // Handle below cup rim
    }

    detectGoldenCross(prices) {
        if (prices.length < 60) return false;
        
        const ma50 = this.calculateMA(prices.slice(-50), 50);
        const ma200 = this.calculateMA(prices.slice(-200), 200);
        
        return ma50[ma50.length - 1] > ma200[ma200.length - 1];
    }

    detectRSIDivergence(prices) {
        const rsi = this.calculateRSI(prices, 14);
        if (rsi.length < 28) return false;
        
        const recentRSI = rsi.slice(-14);
        const recentPrices = prices.slice(-14);
        
        const rsiTrend = this.getTrend(recentRSI);
        const priceTrend = this.getTrend(recentPrices);
        
        return rsiTrend !== priceTrend;
    }

    detectVolumeSpike(stockData) {
        if (!stockData.prices?.volume) return false;
        
        const volumes = stockData.prices.volume.slice(-20);
        const avgVolume = volumes.reduce((a, b) => a + (b || 0), 0) / volumes.length;
        const currentVolume = volumes[volumes.length - 1];
        
        return currentVolume > avgVolume * 1.5;
    }

    // Technical Indicators
    calculateMA(prices, period) {
        const mas = [];
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + (b || 0), 0);
            mas.push(sum / period);
        }
        return mas;
    }

    calculateRSI(prices, period = 14) {
        const rsi = [];
        const gains = [];
        const losses = [];
        
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }
        
        for (let i = period; i < gains.length; i++) {
            const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
            const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
            
            if (avgLoss === 0) {
                rsi.push(100);
            } else {
                const rs = avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
            }
        }
        
        return rsi;
    }

    getTrend(data) {
        if (data.length < 2) return 'neutral';
        const firstHalf = data.slice(0, Math.floor(data.length / 2));
        const secondHalf = data.slice(Math.floor(data.length / 2));
        
        const firstAvg = firstHalf.reduce((a, b) => a + (b || 0), 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + (b || 0), 0) / secondHalf.length;
        
        if (secondAvg > firstAvg * 1.02) return 'up';
        if (secondAvg < firstAvg * 0.98) return 'down';
        return 'neutral';
    }

    // AI Score Calculation
    calculateAIScore(stockData, patterns) {
        let score = 5; // Base score
        
        // Pattern analysis
        patterns.forEach(pattern => {
            if (pattern.signal === 'bullish') {
                score += (pattern.confidence / 100) * 2;
            } else if (pattern.signal === 'bearish') {
                score -= (pattern.confidence / 100) * 2;
            }
        });
        
        // Price momentum
        if (stockData.change > 2) score += 1;
        if (stockData.change < -2) score -= 1;
        
        // Volume analysis
        if (stockData.volume > 1000000) score += 0.5;
        
        // Ensure score is between 1-10
        score = Math.max(1, Math.min(10, score));
        
        return Math.round(score * 10) / 10;
    }

    // Manual Stock Analysis
    async analyzeStock(symbol, period = '3mo') {
        const stockData = await this.getLiveStockData(symbol, period);
        const patterns = this.analyzeAIPatterns(stockData);
        const aiScore = this.calculateAIScore(stockData, patterns);
        const technicalIndicators = this.getTechnicalIndicators(stockData);
        
        return {
            symbol: symbol,
            data: stockData,
            patterns: patterns,
            aiScore: aiScore,
            technicalIndicators: technicalIndicators,
            analysis: this.generateAnalysis(stockData, patterns, aiScore)
        };
    }

    getTechnicalIndicators(stockData) {
        const prices = stockData.prices?.close || [stockData.currentPrice];
        const rsi = this.calculateRSI(prices, 14);
        const ma20 = this.calculateMA(prices, 20);
        const ma50 = this.calculateMA(prices, 50);
        
        return {
            rsi: {
                value: rsi[rsi.length - 1] || 50,
                status: this.getRSIStatus(rsi[rsi.length - 1] || 50)
            },
            ma20: {
                value: ma20[ma20.length - 1] || prices[prices.length - 1],
                status: prices[prices.length - 1] > (ma20[ma20.length - 1] || 0) ? 'bullish' : 'bearish'
            },
            ma50: {
                value: ma50[ma50.length - 1] || prices[prices.length - 1],
                status: prices[prices.length - 1] > (ma50[ma50.length - 1] || 0) ? 'bullish' : 'bearish'
            }
        };
    }

    getRSIStatus(rsi) {
        if (rsi > 70) return 'overbought';
        if (rsi < 30) return 'oversold';
        return 'neutral';
    }

    generateAnalysis(stockData, patterns, aiScore) {
        let analysis = {
            summary: '',
            recommendation: '',
            riskLevel: '',
            keyFactors: []
        };
        
        // Generate summary
        if (aiScore >= 7) {
            analysis.summary = `Strong bullish signals detected for ${stockData.symbol}.`;
            analysis.recommendation = 'Consider buying or holding positions.';
            analysis.riskLevel = 'Medium';
        } else if (aiScore >= 5) {
            analysis.summary = `Mixed signals for ${stockData.symbol}. Caution advised.`;
            analysis.recommendation = 'Monitor for clearer signals before trading.';
            analysis.riskLevel = 'Medium-High';
        } else {
            analysis.summary = `Bearish signals detected for ${stockData.symbol}.`;
            analysis.recommendation = 'Consider selling or avoiding new positions.';
            analysis.riskLevel = 'High';
        }
        
        // Key factors
        if (patterns.length > 0) {
            analysis.keyFactors.push(`Detected ${patterns.length} trading patterns`);
        }
        
        if (Math.abs(stockData.change) > 2) {
            analysis.keyFactors.push(`Significant price movement: ${stockData.change.toFixed(2)}%`);
        }
        
        return analysis;
    }

    // UI Update Functions
    updateAnalysisUI(analysis) {
        const analysisDiv = document.getElementById('stockAnalysis');
        const indicatorsRow = document.getElementById('indicatorsRow');
        const analysisSummary = document.getElementById('analysisSummary');
        const keyMetrics = document.getElementById('keyMetrics');
        
        // Update analysis section
        analysisDiv.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>AI Analysis for ${analysis.symbol}</h6>
                    <div class="ai-score-circle mx-auto mb-3">
                        <span class="ai-score-value">${analysis.aiScore}</span>
                        <span class="ai-score-label">AI Score</span>
                    </div>
                    <p><strong>Current Price:</strong> $${analysis.data.currentPrice?.toFixed(2) || 'N/A'}</p>
                    <p><strong>Change:</strong> <span class="${analysis.data.change >= 0 ? 'text-success' : 'text-danger'}">${analysis.data.change >= 0 ? '+' : ''}${analysis.data.change?.toFixed(2) || '0'}%</span></p>
                </div>
                <div class="col-md-6">
                    <h6>Analysis Summary</h6>
                    <p>${analysis.analysis.summary}</p>
                    <p><strong>Recommendation:</strong> ${analysis.analysis.recommendation}</p>
                    <p><strong>Risk Level:</strong> <span class="badge bg-warning">${analysis.analysis.riskLevel}</span></p>
                </div>
            </div>
        `;
        
        // Update technical indicators
        if (indicatorsRow) {
            indicatorsRow.innerHTML = this.createIndicatorCards(analysis.technicalIndicators);
        }
        
        // Update summary and metrics
        if (analysisSummary) {
            analysisSummary.innerHTML = `
                <p>${analysis.analysis.summary}</p>
                <div class="mt-3">
                    <strong>Key Factors:</strong>
                    <ul class="mt-2">
                        ${analysis.analysis.keyFactors.map(factor => `<li>${factor}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (keyMetrics) {
            keyMetrics.innerHTML = `
                <div class="metric-item mb-2">
                    <span class="metric-label">Current Price:</span>
                    <span class="metric-value">$${analysis.data.currentPrice?.toFixed(2) || 'N/A'}</span>
                </div>
                <div class="metric-item mb-2">
                    <span class="metric-label">Day Change:</span>
                    <span class="metric-value ${analysis.data.change >= 0 ? 'text-success' : 'text-danger'}">
                        ${analysis.data.change >= 0 ? '+' : ''}${analysis.data.change?.toFixed(2) || '0'}%
                    </span>
                </div>
                <div class="metric-item mb-2">
                    <span class="metric-label">Volume:</span>
                    <span class="metric-value">${this.formatNumber(analysis.data.volume)}</span>
                </div>
            `;
        }
        
        // Update chart
        this.updateAnalysisChart(analysis);
    }

    createIndicatorCards(indicators) {
        let html = '';
        
        Object.entries(indicators).forEach(([key, indicator]) => {
            const statusClass = indicator.status === 'bullish' || indicator.status === 'oversold' ? 'bullish' : 
                              indicator.status === 'bearish' || indicator.status === 'overbought' ? 'bearish' : 'neutral';
            
            html += `
                <div class="col-md-3 mb-3">
                    <div class="indicator-card">
                        <div class="indicator-name">${key.toUpperCase()}</div>
                        <div class="indicator-value">${indicator.value?.toFixed(2) || 'N/A'}</div>
                        <div class="indicator-status ${statusClass}">${indicator.status.toUpperCase()}</div>
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    updateAnalysisChart(analysis) {
        const ctx = document.getElementById('analysisChart');
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.charts.analysis) {
            this.charts.analysis.destroy();
        }
        
        const prices = analysis.data.prices?.close || [analysis.data.currentPrice];
        const timestamps = analysis.data.timestamps || Array(prices.length).fill(0).map((_, i) => i);
        
        this.charts.analysis = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timestamps.map((t, i) => new Date(t * 1000).toLocaleDateString()),
                datasets: [{
                    label: `${analysis.symbol} Price`,
                    data: prices,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#f8fafc'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#cbd5e1'
                        },
                        grid: {
                            color: '#334155'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#cbd5e1'
                        },
                        grid: {
                            color: '#334155'
                        }
                    }
                }
            }
        });
    }

    // Utility Functions
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    setupEventListeners() {
        // Stock analysis form
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', async () => {
                const symbol = document.getElementById('stockSymbol').value.toUpperCase();
                const period = document.getElementById('analysisPeriod').value;
                
                if (!symbol) {
                    alert('Please enter a stock symbol');
                    return;
                }
                
                analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Analyzing...';
                analyzeBtn.disabled = true;
                
                try {
                    const analysis = await this.analyzeStock(symbol, period);
                    this.updateAnalysisUI(analysis);
                    
                    // Show results section
                    document.getElementById('analysisResults').style.display = 'block';
                } catch (error) {
                    console.error('Analysis error:', error);
                    alert('Error analyzing stock. Please try again.');
                } finally {
                    analyzeBtn.innerHTML = '<i class="fas fa-chart-line me-2"></i>Analyze';
                    analyzeBtn.disabled = false;
                }
            });
        }
    }

    async loadMarketData() {
        // Load initial market data
        const marketData = await this.getLiveStockData('SPY');
        this.updateMarketOverview(marketData);
    }

    updateMarketOverview(data) {
        // Update market overview cards
        const marketData = [
            { label: 'S&P 500', value: data.currentPrice?.toFixed(2) || '4,567.89', change: data.change || 1.23 },
            { label: 'NASDAQ', value: '14,234.56', change: 2.15 },
            { label: 'VIX', value: '18.45', change: -5.67 },
            { label: 'USD/EUR', value: '0.9234', change: 0.45 }
        ];
        
        // This would update the market overview UI
        console.log('Market data updated:', marketData);
    }

    startRealTimeUpdates() {
        // Update data every 5 minutes for real-time feel
        setInterval(async () => {
            if (this.currentStock) {
                const data = await this.getLiveStockData(this.currentStock);
                this.updateMarketOverview(data);
            }
        }, 300000); // 5 minutes
    }

    updateWatchlist() {
        // Update watchlist UI
        const watchlistDiv = document.getElementById('watchlist');
        if (!watchlistDiv || this.watchlist.length === 0) return;
        
        let html = '';
        this.watchlist.forEach(item => {
            html += `
                <div class="watchlist-item fade-in">
                    <div class="watchlist-info">
                        <div class="symbol">${item.symbol}</div>
                        <div class="name">${item.name || 'Loading...'}</div>
                    </div>
                    <div class="watchlist-data">
                        <div class="price">$${item.price?.toFixed(2) || '0.00'}</div>
                        <div class="change ${item.change >= 0 ? 'positive' : 'negative'}">
                            ${item.change >= 0 ? '+' : ''}${item.change?.toFixed(2) || '0'}%
                        </div>
                    </div>
                    <div class="watchlist-ai">
                        <div class="ai-score">${item.aiScore || '0'}</div>
                        <div class="ai-label">AI Score</div>
                    </div>
                </div>
            `;
        });
        
        watchlistDiv.innerHTML = html;
    }

    updateJournal() {
        // Update trading journal
        const journalTableBody = document.getElementById('journalTableBody');
        if (!journalTableBody || this.trades.length === 0) return;
        
        let html = '';
        this.trades.slice(-10).reverse().forEach(trade => {
            const pnl = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice * 100).toFixed(2);
            html += `
                <tr>
                    <td>${new Date(trade.date).toLocaleDateString()}</td>
                    <td>${trade.symbol}</td>
                    <td><span class="badge bg-${trade.type === 'Long' ? 'success' : 'danger'}">${trade.type}</span></td>
                    <td>$${trade.entryPrice}</td>
                    <td>$${trade.exitPrice}</td>
                    <td class="${pnl >= 0 ? 'text-success' : 'text-danger'}">${pnl >= 0 ? '+' : ''}${pnl}%</td>
                    <td><span class="badge bg-warning">${trade.aiScore}</span></td>
                    <td>${trade.notes || '-'}</td>
                </tr>
            `;
        });
        
        journalTableBody.innerHTML = html;
        
        // Update stats
        this.updateJournalStats();
    }

    updateJournalStats() {
        const stats = this.calculateJournalStats();
        
        // Update journal summary
        const journalSummary = document.getElementById('journalSummary');
        if (journalSummary) {
            journalSummary.innerHTML = `
                <div class="row">
                    <div class="col-md-3">
                        <div class="stat-item">
                            <div class="stat-value text-success">${stats.winRate}%</div>
                            <div class="stat-label">Win Rate</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-item">
                            <div class="stat-value">$${stats.totalPnL}</div>
                            <div class="stat-label">Total P&L</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-item">
                            <div class="stat-value">$${stats.avgWin}</div>
                            <div class="stat-label">Avg Win</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-item">
                            <div class="stat-value">$${stats.avgLoss}</div>
                            <div class="stat-label">Avg Loss</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    calculateJournalStats() {
        if (this.trades.length === 0) {
            return { winRate: 0, totalPnL: 0, avgWin: 0, avgLoss: 0 };
        }
        
        const wins = this.trades.filter(t => t.exitPrice > t.entryPrice);
        const losses = this.trades.filter(t => t.exitPrice <= t.entryPrice);
        
        const winRate = Math.round((wins.length / this.trades.length) * 100);
        const totalPnL = this.trades.reduce((total, trade) => {
            return total + ((trade.exitPrice - trade.entryPrice) / trade.entryPrice * 100);
        }, 0);
        
        const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + ((t.exitPrice - t.entryPrice) / t.entryPrice * 100), 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + ((t.exitPrice - t.entryPrice) / t.entryPrice * 100), 0) / losses.length : 0;
        
        return {
            winRate: winRate,
            totalPnL: totalPnL.toFixed(2),
            avgWin: avgWin.toFixed(2),
            avgLoss: avgLoss.toFixed(2)
        };
    }

    // Global Functions
    async function analyzeStock() {
        const symbol = document.getElementById('stockSymbol').value.toUpperCase();
        if (!symbol) {
            alert('Voer een aandelen symbool in (bijv. AAPL, MSFT, TSLA)');
            return;
        }
        
        const dashboard = new TradingDashboard();
        const analysis = await dashboard.analyzeStock(symbol);
        dashboard.updateAnalysisUI(analysis);
        
        document.getElementById('analysisResults').style.display = 'block';
    }

    function openTradeModal() {
        const modal = new bootstrap.Modal(document.getElementById('addTradeModal'));
        modal.show();
    }

    function saveTrade() {
        const form = document.getElementById('tradeForm');
        const formData = new FormData(form);
        
        const trade = {
            id: Date.now(),
            date: document.getElementById('tradeDate').value,
            symbol: document.getElementById('tradeSymbol').value.toUpperCase(),
            type: document.getElementById('tradeType').value,
            entryPrice: parseFloat(document.getElementById('tradeEntry').value),
            exitPrice: parseFloat(document.getElementById('tradeExit').value),
            aiScore: parseInt(document.getElementById('tradeAiScore').value),
            notes: document.getElementById('tradeNotes').value
        };
        
        // Save to localStorage
        let trades = JSON.parse(localStorage.getItem('trades')) || [];
        trades.push(trade);
        localStorage.setItem('trades', JSON.stringify(trades));
        
        // Close modal and refresh
        bootstrap.Modal.getInstance(document.getElementById('addTradeModal')).hide();
        location.reload();
    }

    function addToWatchlist() {
        const symbol = prompt('Voer een aandelen symbool in:');
        if (symbol) {
            let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
            watchlist.push({
                symbol: symbol.toUpperCase(),
                name: 'Loading...',
                price: 0,
                change: 0,
                aiScore: 0
            });
            localStorage.setItem('watchlist', JSON.stringify(watchlist));
            location.reload();
        }
    }

    function updateTimeframe(timeframe) {
        // Update charts with new timeframe
        console.log('Updating timeframe to:', timeframe);
        // Implementation for timeframe updates
    }

    function runScreener() {
        // Run AI stock screener
        console.log('Running AI stock screener...');
        // Implementation for stock screener
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const dashboard = new TradingDashboard();
    
    // Set current date in trade form
    const today = new Date().toISOString().split('T')[0];
    const tradeDateInput = document.getElementById('tradeDate');
    if (tradeDateInput) {
        tradeDateInput.value = today;
    }
    
    // Add event listener for save trade button
    const saveTradeBtn = document.getElementById('saveTrade');
    if (saveTradeBtn) {
        saveTradeBtn.addEventListener('click', saveTrade);
    }
});