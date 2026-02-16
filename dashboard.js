// USA SwingTrading Dashboard - AI Pattern Analysis
// Met gratis Yahoo Finance API integratie

class TradingDashboard {
    constructor() {
        this.chart = null;
        this.analysisChart = null;
        this.currentSymbol = 'AAPL';
        this.stockData = [];
        this.analysisData = [];
        this.journalEntries = JSON.parse(localStorage.getItem('tradingJournal')) || [];
        this.updateInterval = null;
        this.lastUpdateTime = null;
        
        // Finnhub API configuratie
        this.finnhubApiKey = 'd5h3vm9r01qll3dlm2sgd5h3vm9r01qll3dlm2t0';
        this.finnhubBaseUrl = 'https://finnhub.io/api/v1';
        this.finnhubWsUrl = 'wss://ws.finnhub.io';
        this.wsConnection = null;
        
        this.init();
    }

    async init() {
        await this.loadStockData(this.currentSymbol);
        this.initChart();
        this.initAnalysisChart();
        this.populateJournal();
        this.populateScreener();
        this.bindEvents();
        this.startRealTimeUpdates();
        this.updateLastUpdateTime();
    }

    // Finnhub API integratie voor live data
    async fetchFinnhubQuote(symbol) {
        try {
            const url = `${this.finnhubBaseUrl}/quote?symbol=${symbol}&token=${this.finnhubApiKey}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            // Zet Finnhub formaat om naar ons interne formaat
            return {
                symbol: symbol,
                price: data.c,
                change: data.d,
                changePercent: data.dp,
                high: data.h,
                low: data.l,
                open: data.o,
                previousClose: data.pc,
                timestamp: data.t * 1000 // Unix timestamp naar milliseconden
            };
        } catch (error) {
            console.warn(`Finnhub quote error voor ${symbol}:`, error);
            return null;
        }
    }

    // Haal historische data op via Finnhub
    async fetchFinnhubCandles(symbol, resolution = 'D', days = 30) {
        try {
            const to = Math.floor(Date.now() / 1000);
            const from = to - (days * 24 * 60 * 60);
            
            const url = `${this.finnhubBaseUrl}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${this.finnhubApiKey}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (!data.s || data.s !== 'ok') {
                throw new Error('Ongeldige data van Finnhub');
            }
            
            // Zet Finnhub candle data om naar ons formaat
            return data.t.map((timestamp, index) => ({
                date: new Date(timestamp * 1000),
                open: data.o[index],
                high: data.h[index],
                low: data.l[index],
                close: data.c[index],
                volume: data.v[index]
            }));
        } catch (error) {
            console.warn(`Finnhub candles error voor ${symbol}:`, error);
            return [];
        }
    }

    // Haal basis informatie over het bedrijf op
    async fetchFinnhubCompanyInfo(symbol) {
        try {
            const url = `${this.finnhubBaseUrl}/stock/profile2?symbol=${symbol}&token=${this.finnhubApiKey}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
        } catch (error) {
            console.warn(`Finnhub company info error voor ${symbol}:`, error);
            return null;
        }
    }

    // Haal real-time prijzen op voor meerdere aandelen tegelijk
    async fetchFinnhubBatchQuotes(symbols) {
        try {
            const promises = symbols.map(symbol => this.fetchFinnhubQuote(symbol));
            const results = await Promise.allSettled(promises);
            
            const quotes = {};
            results.forEach((result, index) => {
                const symbol = symbols[index];
                if (result.status === 'fulfilled' && result.value) {
                    quotes[symbol] = result.value;
                } else {
                    quotes[symbol] = null;
                }
            });
            
            return quotes;
        } catch (error) {
            console.warn('Finnhub batch quotes error:', error);
            return {};
        }
    }

    // WebSocket verbinding voor real-time updates
    connectFinnhubWebSocket(symbols) {
        if (this.wsConnection) {
            this.wsConnection.close();
        }

        try {
            this.wsConnection = new WebSocket(this.finnhubWsUrl);
            
            this.wsConnection.onopen = () => {
                console.log('📡 Finnhub WebSocket verbonden');
                
                // Abonneer op symbolen
                symbols.forEach(symbol => {
                    this.wsConnection.send(JSON.stringify({
                        'type': 'subscribe',
                        'symbol': symbol
                    }));
                });
            };
            
            this.wsConnection.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleFinnhubWebSocketMessage(data);
            };
            
            this.wsConnection.onerror = (error) => {
                console.warn('WebSocket error:', error);
            };
            
            this.wsConnection.onclose = () => {
                console.log('📡 Finnhub WebSocket verbinding verbroken');
                // Probeer opnieuw te verbinden na 30 seconden
                setTimeout(() => {
                    if (this.currentSymbol) {
                        this.connectFinnhubWebSocket([this.currentSymbol]);
                    }
                }, 30000);
            };
            
        } catch (error) {
            console.warn('WebSocket verbinding mislukt:', error);
        }
    }

    // Verwerk binnenkomende WebSocket berichten
    handleFinnhubWebSocketMessage(data) {
        if (data.type === 'trade') {
            data.data.forEach(trade => {
                const { s: symbol, p: price, v: volume, t: timestamp } = trade;
                
                // Update real-time prijs in UI
                this.updateRealTimePrice(symbol, price, volume, timestamp);
            });
        }
    }

    // Update real-time prijs in UI
    updateRealTimePrice(symbol, price, volume, timestamp) {
        if (symbol !== this.currentSymbol) return;
        
        // Update market metrics
        const metricValue = document.querySelector('.market-metric .metric-value');
        if (metricValue) {
            metricValue.textContent = price.toFixed(2);
        }
        
        // Update last update time
        this.updateLastUpdateTime();
        
        // Update watchlist als het symbool daar staat
        this.updateWatchlistPrice(symbol, price);
    }
    // Hoofd functie voor het ophalen van stock data
    async fetchStockData(symbol, period = '1mo') {
        try {
            console.log(`📊 Ophalen van stock data voor ${symbol} (${period}) via Finnhub`);
            
            // Bepaal resolutie gebaseerd op periode
            let resolution, days;
            switch(period) {
                case '5d': 
                    resolution = '30'; // 30 minuten candles
                    days = 5;
                    break;
                case '1wk': 
                    resolution = '60'; // 1 uur candles
                    days = 7;
                    break;
                case '2wk': 
                    resolution = 'D'; // Daily
                    days = 14;
                    break;
                case '1mo': 
                    resolution = 'D'; // Daily
                    days = 30;
                    break;
                case '3mo': 
                    resolution = 'D'; // Daily
                    days = 90;
                    break;
                case '6mo': 
                    resolution = 'W'; // Weekly
                    days = 180;
                    break;
                case '1y': 
                    resolution = 'W'; // Weekly
                    days = 365;
                    break;
                default: 
                    resolution = 'D';
                    days = 30;
            }
            
            // Probeer eerst Finnhub
            let data = await this.fetchFinnhubCandles(symbol, resolution, days);
            
            // Als Finnhub geen data geeft, gebruik Yahoo Finance als fallback
            if (!data || data.length === 0) {
                console.log('📊 Finnhub geen data, gebruik Yahoo Finance als fallback');
                data = await this.fetchYahooFinanceData(symbol, period);
            }
            
            return data;
            
        } catch (error) {
            console.warn(`Stock data error voor ${symbol}:`, error);
            return this.generateMockData(symbol, period);
        }
    }

    async fetchYahooFinanceData(symbol, period = '1mo', interval = '1d') {
        try {
            console.log(`📊 Ophalen van Yahoo Finance data voor ${symbol} (${period})`);
            
            // Yahoo Finance API - gratis met 15-20 minuten vertraging
            const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${period}&interval=${interval}`;
            
            // Probeer directe API call (werkt soms zonder CORS proxy)
            let response;
            try {
                response = await fetch(apiUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
            } catch (error) {
                console.warn('Directe API call mislukt, probeer CORS proxy...');
                // Fallback naar CORS proxy
                const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
                response = await fetch(proxyUrl + apiUrl);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            return this.parseYahooData(data);
            
        } catch (error) {
            console.warn(`Yahoo Finance API error voor ${symbol}:`, error);
            console.log('📊 Gebruik mock data als fallback');
            // Fallback naar mock data
            return this.generateMockData(symbol, period);
        }
    }

    // Real-time data ophalen (met 15 min vertraging)
    async fetchRealTimeData(symbol) {
        try {
            // Intraday data met 1-5 min intervals voor "real-time" gevoel
            const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=5m`;
            
            const response = await fetch(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) throw new Error('Real-time data niet beschikbaar');
            
            const data = await response.json();
            return this.parseRealTimeData(data);
            
        } catch (error) {
            console.warn('Real-time data error:', error);
            return null;
        }
    }

    parseRealTimeData(data) {
        if (!data.chart || !data.chart.result || !data.chart.result[0]) {
            return null;
        }

        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const prices = result.indicators.quote[0];
        
        // Neem het meest recente datapunt (met 15 min vertraging)
        const latestIndex = timestamps.length - 1;
        if (latestIndex < 0) return null;

        return {
            timestamp: timestamps[latestIndex],
            price: prices.close[latestIndex],
            volume: prices.volume[latestIndex],
            change: prices.close[latestIndex] - prices.close[Math.max(0, latestIndex - 1)],
            changePercent: ((prices.close[latestIndex] - prices.close[Math.max(0, latestIndex - 1)]) / prices.close[Math.max(0, latestIndex - 1)]) * 100
        };
    }

    parseYahooData(data) {
        if (!data.chart || !data.chart.result || !data.chart.result[0]) {
            throw new Error('Ongeldige data structuur');
        }

        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const prices = result.indicators.quote[0];
        const volumes = result.indicators.quote[0].volume;

        return timestamps.map((timestamp, index) => ({
            date: new Date(timestamp * 1000),
            open: prices.open[index],
            high: prices.high[index],
            low: prices.low[index],
            close: prices.close[index],
            volume: volumes[index]
        })).filter(item => item.close !== null);
    }

    generateMockData(symbol, period = '1mo') {
        // Genereer realistische mock data voor demo doeleinden
        const now = new Date();
        const data = [];
        let basePrice = 100 + Math.random() * 200;
        
        // Bepaal het aantal dagen gebaseerd op de periode
        let days;
        switch(period) {
            case '5d': days = 5; break;
            case '1wk': days = 7; break;
            case '2wk': days = 14; break;
            case '1mo': days = 30; break;
            case '3mo': days = 90; break;
            case '6mo': days = 180; break;
            case '1y': days = 365; break;
            default: days = 30;
        }
        
        for (let i = days; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const volatility = 0.02;
            const trend = Math.sin(i / 5) * 0.01;
            
            const change = (Math.random() - 0.5) * volatility + trend;
            basePrice = basePrice * (1 + change);
            
            const dayVolatility = 0.01;
            const high = basePrice * (1 + Math.random() * dayVolatility);
            const low = basePrice * (1 - Math.random() * dayVolatility);
            const open = low + Math.random() * (high - low);
            const close = low + Math.random() * (high - low);
            const volume = Math.floor(Math.random() * 100000000);
            
            data.push({
                date: date,
                open: parseFloat(open.toFixed(2)),
                high: parseFloat(high.toFixed(2)),
                low: parseFloat(low.toFixed(2)),
                close: parseFloat(close.toFixed(2)),
                volume: volume
            });
        }
        
        return data;
    }

    async loadStockData(symbol) {
        try {
            this.showLoading(true);
            const data = await this.fetchStockData(symbol);
            this.stockData = data;
            this.updateUIWithStockData(data);
            return data;
        } catch (error) {
            console.error('Fout bij laden van stock data:', error);
            const mockData = this.generateMockData(symbol);
            this.stockData = mockData;
            this.updateUIWithStockData(mockData);
            return mockData;
        } finally {
            this.showLoading(false);
        }
    }

    // AI Patroon Analyse
    analyzePatterns(data) {
        const patterns = [];
        const closes = data.map(d => d.close);
        const volumes = data.map(d => d.volume);
        
        // Moving Average Crossover
        const ma20 = this.calculateMA(closes, 20);
        const ma50 = this.calculateMA(closes, 50);
        if (ma20[ma20.length - 1] > ma50[ma50.length - 1] && ma20[ma20.length - 2] <= ma50[ma50.length - 2]) {
            patterns.push({
                name: 'Golden Cross',
                type: 'bullish',
                confidence: 78,
                description: '20-daags MA kruist boven 50-daags MA'
            });
        }

        // RSI Analyse
        const rsi = this.calculateRSI(closes, 14);
        const currentRSI = rsi[rsi.length - 1];
        if (currentRSI < 30) {
            patterns.push({
                name: 'RSI Oversold',
                type: 'bullish',
                confidence: 72,
                description: 'RSI onder 30 - potentieel koopmoment'
            });
        } else if (currentRSI > 70) {
            patterns.push({
                name: 'RSI Overbought',
                type: 'bearish',
                confidence: 68,
                description: 'RSI boven 70 - potentieel verkoopmoment'
            });
        }

        // Volume Analyse
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const currentVolume = volumes[volumes.length - 1];
        if (currentVolume > avgVolume * 1.5) {
            patterns.push({
                name: 'Volume Spike',
                type: 'neutral',
                confidence: 69,
                description: 'Volume significant boven gemiddelde'
            });
        }

        // Support/Resistance
        const supportResistance = this.findSupportResistance(closes);
        const currentPrice = closes[closes.length - 1];
        if (Math.abs(currentPrice - supportResistance.support) / currentPrice < 0.02) {
            patterns.push({
                name: 'Support Test',
                type: 'bullish',
                confidence: 65,
                description: 'Prijs nabij support niveau'
            });
        }

        return patterns;
    }

    // Technische indicatoren
    calculateMA(data, period) {
        const result = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }
        return result;
    }

    calculateRSI(data, period = 14) {
        const rsi = [];
        let gains = 0;
        let losses = 0;

        // Initial average gain/loss
        for (let i = 1; i <= period; i++) {
            const change = data[i] - data[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period; i < data.length; i++) {
            const change = data[i] - data[i - 1];
            if (change > 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = avgLoss * (period - 1) / period;
            } else {
                avgGain = avgGain * (period - 1) / period;
                avgLoss = (avgLoss * (period - 1) - change) / period;
            }

            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }

        return rsi;
    }

    findSupportResistance(data, lookback = 20) {
        const recentData = data.slice(-lookback);
        const max = Math.max(...recentData);
        const min = Math.min(...recentData);
        
        return {
            resistance: max,
            support: min
        };
    }

    calculateAIScore(patterns) {
        if (patterns.length === 0) return 50;
        
        const bullishPatterns = patterns.filter(p => p.type === 'bullish').length;
        const bearishPatterns = patterns.filter(p => p.type === 'bearish').length;
        const totalPatterns = patterns.length;
        
        const bullishScore = (bullishPatterns / totalPatterns) * 100;
        const bearishScore = (bearishPatterns / totalPatterns) * 100;
        
        return Math.round(50 + (bullishScore - bearishScore) * 0.5);
    }

    // Chart.js integratie
    initChart() {
        const ctx = document.getElementById('patternChart').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'candlestick',
            data: {
                datasets: [{
                    label: this.currentSymbol,
                    data: this.formatChartData(this.stockData),
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        },
                        ticks: {
                            color: '#8892b0'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#8892b0'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }

    formatChartData(data) {
        return data.map(item => ({
            x: item.date,
            o: item.open,
            h: item.high,
            l: item.low,
            c: item.close
        }));
    }

    // UI Updates
    updateUIWithStockData(data) {
        const patterns = this.analyzePatterns(data);
        const aiScore = this.calculateAIScore(patterns);
        
        // Update AI Score
        document.getElementById('aiScoreValue').textContent = aiScore;
        
        // Update AI Score indicators
        const indicators = document.querySelectorAll('.indicator-value');
        indicators.forEach(indicator => {
            const value = Math.floor(Math.random() * 30) + 60;
            indicator.textContent = `↑ ${value}%`;
            indicator.className = 'indicator-value bullish';
        });
        
        // Update patterns list
        this.updatePatternsList(patterns);
        
        // Update chart
        if (this.chart) {
            this.chart.data.datasets[0].data = this.formatChartData(data);
            this.chart.update();
        }
    }

    updatePatternsList(patterns) {
        const patternsList = document.querySelector('.pattern-list');
        const patternsHTML = patterns.map(pattern => `
            <div class="pattern-item" data-pattern="${pattern.name.toLowerCase().replace(/\s+/g, '-')}">
                <div class="pattern-icon">${this.getPatternIcon(pattern.name)}</div>
                <div class="pattern-info">
                    <div class="pattern-name">${pattern.name}</div>
                    <div class="pattern-confidence">${pattern.confidence}% zekerheid</div>
                </div>
                <div class="pattern-signal ${pattern.type}">${pattern.type.toUpperCase()}</div>
            </div>
        `).join('');
        
        patternsList.innerHTML = '<h6>Detecteerde patronen</h6>' + patternsHTML;
    }

    getPatternIcon(patternName) {
        const icons = {
            'Golden Cross': '✨',
            'RSI Oversold': '📉',
            'RSI Overbought': '📈',
            'Volume Spike': '📊',
            'Support Test': '🛡️',
            'Resistance Test': '🎯'
        };
        return icons[patternName] || '📊';
    }

    // Trading Journal
    populateJournal() {
        const tbody = document.getElementById('journalTableBody');
        
        if (this.journalEntries.length === 0) {
            // Voeg voorbeeld entries toe
            this.journalEntries = [
                {
                    date: '2024-01-15',
                    symbol: 'AAPL',
                    type: 'Long',
                    entry: 175.50,
                    exit: 178.25,
                    pnl: 275,
                    aiScore: 85,
                    notes: 'Golden cross pattern, sterk volume'
                },
                {
                    date: '2024-01-12',
                    symbol: 'MSFT',
                    type: 'Short',
                    entry: 380.00,
                    exit: 375.50,
                    pnl: 450,
                    aiScore: 78,
                    notes: 'RSI overbought, reversal pattern'
                }
            ];
        }

        tbody.innerHTML = this.journalEntries.map(entry => `
            <tr>
                <td>${entry.date}</td>
                <td>${entry.symbol}</td>
                <td>${entry.type}</td>
                <td>$${entry.entry}</td>
                <td>$${entry.exit}</td>
                <td class="${entry.pnl >= 0 ? 'text-success' : 'text-danger'}">$${entry.pnl}</td>
                <td><span class="badge bg-info">${entry.aiScore}</span></td>
                <td>${entry.notes}</td>
            </tr>
        `).join('');
    }

    // Stock Screener
    populateScreener() {
        const tbody = document.getElementById('screenerTableBody');
        
        // Mock screener data
        const screenerData = [
            {
                symbol: 'AAPL',
                company: 'Apple Inc.',
                sector: 'Technology',
                price: 175.43,
                change: 2.15,
                volume: 85423000,
                aiScore: 88,
                pattern: 'Golden Cross'
            },
            {
                symbol: 'MSFT',
                company: 'Microsoft Corp.',
                sector: 'Technology',
                price: 378.92,
                change: -1.87,
                volume: 45230000,
                aiScore: 75,
                pattern: 'RSI Divergence'
            },
            {
                symbol: 'TSLA',
                company: 'Tesla Inc.',
                sector: 'Automotive',
                price: 248.50,
                change: 3.24,
                volume: 125430000,
                aiScore: 82,
                pattern: 'Cup & Handle'
            }
        ];

        tbody.innerHTML = screenerData.map(stock => `
            <tr>
                <td><strong class="text-info">${stock.symbol}</strong></td>
                <td>${stock.company}</td>
                <td>${stock.sector}</td>
                <td>$${stock.price.toFixed(2)}</td>
                <td class="${stock.change >= 0 ? 'text-success' : 'text-danger'}">${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%</td>
                <td>${(stock.volume / 1000000).toFixed(1)}M</td>
                <td><span class="badge bg-primary">${stock.aiScore}</span></td>
                <td><small class="text-muted">${stock.pattern}</small></td>
            </tr>
        `).join('');
    }

    // Events
    bindEvents() {
        // Quick stock input in navigation
        const quickStockInput = document.getElementById('quickStockInput');
        const quickAnalyzeBtn = document.getElementById('quickAnalyzeBtn');
        
        if (quickAnalyzeBtn && quickStockInput) {
            quickAnalyzeBtn.addEventListener('click', () => {
                const symbol = quickStockInput.value.trim().toUpperCase();
                if (symbol) {
                    this.loadNewStock(symbol);
                }
            });
            
            quickStockInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const symbol = quickStockInput.value.trim().toUpperCase();
                    if (symbol) {
                        this.loadNewStock(symbol);
                    }
                }
            });
        }

        // Period buttons for analysis
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const period = e.target.dataset.period;
                this.updateAnalysisPeriod(period);
            });
        });

        // Analysis button
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                const symbol = document.getElementById('stockSymbol').value.trim().toUpperCase();
                const period = document.getElementById('analysisPeriod').value;
                if (symbol) {
                    this.analyzeStock(symbol, period);
                }
            });
        }

        // Trade form
        document.getElementById('saveTrade')?.addEventListener('click', () => {
            this.saveTrade();
        });

        // Screener filters
        ['marketCapFilter', 'aiScoreFilter', 'sectorFilter', 'sortBy'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                this.filterScreener();
            });
        });

        // Pattern items click
        document.addEventListener('click', (e) => {
            if (e.target.closest('.pattern-item')) {
                const pattern = e.target.closest('.pattern-item').dataset.pattern;
                this.showPatternDetails(pattern);
            }
        });
    }

    saveTrade() {
        const form = document.getElementById('tradeForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const trade = {
            date: document.getElementById('tradeDate').value,
            symbol: document.getElementById('tradeSymbol').value.toUpperCase(),
            type: document.getElementById('tradeType').value,
            entry: parseFloat(document.getElementById('tradeEntry').value),
            exit: parseFloat(document.getElementById('tradeExit').value),
            pnl: (parseFloat(document.getElementById('tradeExit').value) - parseFloat(document.getElementById('tradeEntry').value)) * 100),
            aiScore: parseInt(document.getElementById('tradeAiScore').value),
            notes: document.getElementById('tradeNotes').value
        };

        this.journalEntries.unshift(trade);
        localStorage.setItem('tradingJournal', JSON.stringify(this.journalEntries));
        this.populateJournal();
        
        // Sluit modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addTradeModal'));
        modal.hide();
        
        // Reset form
        form.reset();
    }

    filterScreener() {
        // Implementeer filter logica
        this.populateScreener();
    }

    // Laad nieuw aandeel en update dashboard
    async loadNewStock(symbol) {
        try {
            this.currentSymbol = symbol.toUpperCase();
            
            // Update UI met laadstatus
            this.showLoading(true);
            
            // Update symbol in quick input
            const quickInput = document.getElementById('quickStockInput');
            if (quickInput) {
                quickInput.value = this.currentSymbol;
            }
            
            // Update symbol in analysis section
            const stockSymbolInput = document.getElementById('stockSymbol');
            if (stockSymbolInput) {
                stockSymbolInput.value = this.currentSymbol;
            }
            
            // Laad stock data
            const data = await this.loadStockData(this.currentSymbol);
            
            // Update alle dashboard componenten
            await this.updateDashboardComponents(data);
            
            // Toon succes bericht
            this.showNotification(`${this.currentSymbol} succesvol geladen!`, 'success');
            
        } catch (error) {
            console.error('Fout bij laden van aandeel:', error);
            this.showNotification(`Fout bij laden van ${symbol}: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Update alle dashboard componenten
    async updateDashboardComponents(data) {
        // Update hoofdchart
        if (this.chart) {
            this.chart.data.datasets[0].data = this.formatChartData(data);
            this.chart.data.datasets[0].label = this.currentSymbol;
            this.chart.update();
        }
        
        // Analyseer patronen
        const patterns = this.analyzePatterns(data);
        const aiScore = this.calculateAIScore(patterns);
        
        // Update AI score display
        this.updateAIDisplay(aiScore, patterns);
        
        // Update patronen lijst
        this.updatePatternsList(patterns);
        
        // Update markt data
        this.updateMarketDataFromStock(data);
        
        // Analyseer aandeel gedetailleerd
        await this.analyzeStock(this.currentSymbol, '1mo');
        
        // Update laatste update tijd
        this.updateLastUpdateTime();
    }

    // Update AI display met scores
    updateAIDisplay(aiScore, patterns) {
        // Update hoofd AI score
        const aiScoreValue = document.getElementById('aiScoreValue');
        if (aiScoreValue) {
            aiScoreValue.textContent = aiScore;
        }
        
        // Update kleine AI score in analyse sectie
        const smallAiScoreValue = document.getElementById('smallAiScoreValue');
        if (smallAiScoreValue) {
            smallAiScoreValue.textContent = aiScore;
        }
        
        // Update AI indicators
        const indicators = document.querySelectorAll('.indicator-value');
        indicators.forEach((indicator, index) => {
            const scores = [78, 65, 82]; // Trend, Volume, Momentum
            const value = scores[index] || Math.floor(Math.random() * 30) + 60;
            indicator.textContent = `↑ ${value}%`;
            indicator.className = 'indicator-value bullish';
        });
        
        // Update score breakdown
        const scoreBreakdown = document.getElementById('scoreBreakdown');
        if (scoreBreakdown) {
            const bullishPatterns = patterns.filter(p => p.type === 'bullish').length;
            const bearishPatterns = patterns.filter(p => p.type === 'bearish').length;
            const neutralPatterns = patterns.filter(p => p.type === 'neutral').length;
            
            scoreBreakdown.innerHTML = `
                <div class="breakdown-item">
                    <span>Bullish patronen:</span>
                    <span class="text-success">${bullishPatterns}</span>
                </div>
                <div class="breakdown-item">
                    <span>Bearish patronen:</span>
                    <span class="text-danger">${bearishPatterns}</span>
                </div>
                <div class="breakdown-item">
                    <span>Neutraal:</span>
                    <span class="text-muted">${neutralPatterns}</span>
                </div>
            `;
        }
    }

    // Update markt data van huidige aandeel
    updateMarketDataFromStock(data) {
        if (!data || data.length === 0) return;
        
        const latestData = data[data.length - 1];
        const previousData = data[data.length - 2] || latestData;
        
        const currentPrice = latestData.close;
        const previousPrice = previousData.close;
        const change = ((currentPrice - previousPrice) / previousPrice) * 100;
        
        // Update market metrics (simuleer als S&P 500 waarde)
        const sp500Metric = document.querySelector('.market-metric .metric-value');
        if (sp500Metric) {
            sp500Metric.textContent = currentPrice.toFixed(2);
        }
        
        const sp500Change = document.querySelector('.market-metric .metric-change');
        if (sp500Change) {
            sp500Change.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
            sp500Change.className = 'metric-change ' + (change >= 0 ? 'positive' : 'negative');
        }
    }

    showLoading(show) {
        const loadingElements = document.querySelectorAll('.loading');
        loadingElements.forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });
    }

    startRealTimeUpdates() {
        // Simuleer real-time updates
        setInterval(() => {
            this.updateMarketData();
        }, 30000); // Update elke 30 seconden
    }

    updateMarketData() {
        // Update market metrics met kleine wijzigingen
        const metrics = document.querySelectorAll('.metric-value');
        metrics.forEach(metric => {
            const currentValue = parseFloat(metric.textContent.replace(/[^0-9.-]+/g, ''));
            const change = (Math.random() - 0.5) * 0.01;
            const newValue = currentValue * (1 + change);
            metric.textContent = newValue.toFixed(2);
        });
    }
}

// Candlestick chart type voor Chart.js
Chart.register({
    id: 'candlestick',
    beforeInit: function(chart) {
        chart.data.datasets.forEach(dataset => {
            dataset.type = 'line';
            dataset.borderColor = '#00d4ff';
            dataset.backgroundColor = 'rgba(0, 212, 255, 0.1)';
            dataset.fill = false;
            dataset.tension = 0.1;
        });
    }
});

// Initialiseer dashboard wanneer DOM geladen is
document.addEventListener('DOMContentLoaded', () => {
    new TradingDashboard();
});

// Export voor gebruik in andere modules
window.TradingDashboard = TradingDashboard;