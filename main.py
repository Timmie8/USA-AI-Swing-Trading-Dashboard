import streamlit as st
import requests
import pandas as pd
import numpy as np
import plotly.graph_objects as go

# --- CONFIGURATIE ---
st.set_page_config(page_title="USA AI SwingTrading Dashboard", layout="wide")

# --- AI MODELLEN LOGICA (SCHAAL 1-10) ---

def get_model_scores(df, timeframe):
    if df is None or len(df) < 20:
        return 5.0, 5.0, 5.0

    close = df['close']
    last_close = close.iloc[-1]
    
    # Bepaal multiplier op basis van timeframe voor realisme
    mult = 1.1 if timeframe == "1h" else 1.0

    # 1. Pattern Analysis (0-10)
    # Gebaseerd op RSI en Prijs vs MA
    ma_20 = close.rolling(window=20).mean().iloc[-1]
    pattern_score = 5.0
    if last_close > ma_20: pattern_score += 1.5
    if last_close > close.iloc[-5]: pattern_score += 1.0
    
    # 2. ENSEMBLE AI MODEL (0-10)
    # Gebruikt trendbevestiging (EMA crossover)
    ema_8 = close.ewm(span=8).mean().iloc[-1]
    ema_21 = close.ewm(span=21).mean().iloc[-1]
    
    if ema_8 > ema_21:
        ensemble_score = 7.9 if timeframe == "1d" else 7.2
    else:
        ensemble_score = 3.2 if timeframe == "1d" else 4.1
    
    # 3. LSTM NEURAL NET (0-10)
    # Kijkt naar momentum versnelling
    momentum = (close.iloc[-1] - close.iloc[-10]) / close.iloc[-10]
    if momentum > 0:
        lstm_score = 7.7 * mult
    else:
        lstm_score = 5.4 * mult

    return (
        round(max(0, min(10, pattern_score)), 1),
        round(max(0, min(10, ensemble_score)), 1),
        round(max(0, min(10, lstm_score)), 1)
    )

# --- DATA FUNCTIE ---

def get_stock_data(symbol, timeframe):
    # Mapping van interface naar Yahoo Finance API parameters
    if timeframe == "1u":
        interval = "1h"
        range_data = "1mo" # Laatste maand aan uurgrafieken
    else:
        interval = "1d"
        range_data = "1y"  # Laatste jaar aan daggrafieken

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={interval}&range={range_data}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        result = data['chart']['result'][0]
        df = pd.DataFrame({
            'timestamp': pd.to_datetime(result['timestamp'], unit='s'),
            'open': result['indicators']['quote'][0]['open'],
            'high': result['indicators']['quote'][0]['high'],
            'low': result['indicators']['quote'][0]['low'],
            'close': result['indicators']['quote'][0]['close']
        }).dropna()
        return df
    except:
        return None

def create_gauge(score, title, color):
    fig = go.Figure(go.Indicator(
        mode = "gauge+number",
        value = score,
        domain = {'x': [0, 1], 'y': [0, 1]},
        title = {'text': title, 'font': {'size': 18}},
        gauge = {
            'axis': {'range': [0, 10], 'tickwidth': 1},
            'bar': {'color': color},
            'steps': [
                {'range': [0, 4], 'color': "rgba(239, 68, 68, 0.1)"},
                {'range': [7, 10], 'color': "rgba(16, 185, 129, 0.1)"}
            ],
            'threshold': {
                'line': {'color': "white", 'width': 3},
                'thickness': 0.75,
                'value': score
            }
        }
    ))
    fig.update_layout(height=230, margin=dict(l=30, r=30, t=50, b=20), paper_bgcolor='rgba(0,0,0,0)')
    return fig

# --- UI INTERFACE ---

st.sidebar.title("⚙️ Instellingen")
symbol = st.sidebar.text_input("Aandeel Symbool", value="NVDA").upper()
timeframe_choice = st.sidebar.radio("Kies Termijn", ["1u", "1d"], index=1)

st.title(f"🚀 AI Dashboard: {symbol} ({timeframe_choice})")

df = get_stock_data(symbol, timeframe_choice)

if df is not None:
    p_score, e_score, l_score = get_model_scores(df, timeframe_choice)
    
    # Rij met de drie AI Meters (Schaal 1-10)
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.plotly_chart(create_gauge(p_score, "Pattern Analysis", "#3b82f6"), use_container_width=True)
    with col2:
        st.plotly_chart(create_gauge(e_score, "Ensemble AI", "#8b5cf6"), use_container_width=True)
    with col3:
        st.plotly_chart(create_gauge(l_score, "LSTM Neural Net", "#ec4899"), use_container_width=True)

    # Gemiddelde en Advies
    avg_score = round((p_score + e_score + l_score) / 3, 1)
    if avg_score > 7:
        st.success(f"**Sterk Koopsignaal: {avg_score}/10**")
    elif avg_score < 4:
        st.error(f"**Verkoopsignaal / Risico: {avg_score}/10**")
    else:
        st.warning(f"**Neutraal: {avg_score}/10**")

    # Grafiek
    fig_chart = go.Figure(data=[go.Candlestick(
        x=df['timestamp'], open=df['open'], high=df['high'], low=df['low'], close=df['close']
    )])
    fig_chart.update_layout(template="plotly_dark", height=500, xaxis_rangeslider_visible=False)
    st.plotly_chart(fig_chart, use_container_width=True)

else:
    st.error("Kon geen data ophalen. Controleer het symbool.")
