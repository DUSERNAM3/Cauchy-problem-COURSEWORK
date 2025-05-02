import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const BeamSolver = () => {
  // Параметры задачи
  const params = {
    m: 1,      // масса (кг)
    k: 0.2,    // коэффициент вязкого сопротивления
    c: 4,      // коэффициент жесткости
    F0: 1,     // амплитуда внешней силы (Н)
    omega: 2 * Math.PI // частота (рад/с)
  };

  // Начальные условия
  const initialConditions = {
    x: 0.5,    // начальное отклонение (м)
    v: 0,      // начальная скорость (м/с)
    a: -1      // начальное ускорение (м/с²)
  };

  // Состояния компонента
  const [stepSize, setStepSize] = useState(0.01);
  const [method, setMethod] = useState('rkf');
  const [result, setResult] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Функция правой части дифференциального уравнения
  const f = (t, x, v, a) => {
    return (params.F0 * Math.cos(params.omega * t) - params.k * v - params.c * Math.pow(x, 3));
  };

  // Метод Рунге-Кутты-Фельдберга (5-го порядка)
  const solveRKF = (h) => {
    const solution = [];
    let t = 0;
    let x = initialConditions.x;
    let v = initialConditions.v;
    let a = initialConditions.a;
    
    solution.push({ t, x, v, a });

    while (t <= 1) {
      // Коэффициенты для RKF45
      const k1 = h * v;
      const l1 = h * a;
      const m1 = h * f(t, x, v, a) / params.m;
      
      const k2 = h * (v + l1/4);
      const l2 = h * (a + m1/4);
      const m2 = h * f(t + h/4, x + k1/4, v + l1/4, a + m1/4) / params.m;
      
      const k3 = h * (v + 3*l1/32 + 9*l2/32);
      const l3 = h * (a + 3*m1/32 + 9*m2/32);
      const m3 = h * f(t + 3*h/8, x + 3*k1/32 + 9*k2/32, v + 3*l1/32 + 9*l2/32, a + 3*m1/32 + 9*m2/32) / params.m;
      
      const k4 = h * (v + 1932*l1/2197 - 7200*l2/2197 + 7296*l3/2197);
      const l4 = h * (a + 1932*m1/2197 - 7200*m2/2197 + 7296*m3/2197);
      const m4 = h * f(t + 12*h/13, x + 1932*k1/2197 - 7200*k2/2197 + 7296*k3/2197, 
                        v + 1932*l1/2197 - 7200*l2/2197 + 7296*l3/2197, a + 1932*m1/2197 - 7200*m2/2197 + 7296*m3/2197) / params.m;
      
      const k5 = h * (v + 439*l1/216 - 8*l2 + 3680*l3/513 - 845*l4/4104);
      const l5 = h * (a + 439*m1/216 - 8*m2 + 3680*m3/513 - 845*m4/4104);
      const m5 = h * f(t + h, x + 439*k1/216 - 8*k2 + 3680*k3/513 - 845*k4/4104, 
                        v + 439*l1/216 - 8*l2 + 3680*l3/513 - 845*l4/4104, a + 439*m1/216 - 8*m2 + 3680*m3/513 - 845*m4/4104) / params.m;
      
      const k6 = h * (v - 8*l1/27 + 2*l2 - 3544*l3/2565 + 1859*l4/4104 - 11*l5/40);
      const l6 = h * (a - 8*m1/27 + 2*m2 - 3544*m3/2565 + 1859*m4/4104 - 11*m5/40);
      const m6 = h * f(t + h/2, x - 8*k1/27 + 2*k2 - 3544*k3/2565 + 1859*k4/4104 - 11*k5/40, 
                        v - 8*l1/27 + 2*l2 - 3544*l3/2565 + 1859*l4/4104 - 11*l5/40, a - 8*m1/27 + 2*m2 - 3544*m3/2565 + 1859*m4/4104 - 11*m5/40) / params.m;

      // Новые значения
      const xNew = x + 25*k1/216 + 1408*k3/2565 + 2197*k4/4104 - k5/5;
      const vNew = v + 25*l1/216 + 1408*l3/2565 + 2197*l4/4104 - l5/5;
      const aNew = a + 25*m1/216 + 1408*m3/2565 + 2197*m4/4104 - m5/5;
      
      // Оценка ошибки
      const xErr = Math.abs(k1/360 - 128*k3/4275 - 2197*k4/75240 + k5/50 + 2*k6/55);
      const vErr = Math.abs(l1/360 - 128*l3/4275 - 2197*l4/75240 + l5/50 + 2*l6/55);
      
      // Адаптивный шаг (можно добавить логику адаптации)
      // Пока просто используем заданный шаг
      
      t += h;
      x = xNew;
      v = vNew;
      a = aNew;
      
      solution.push({ t, x, v, a });
    }
    
    return solution;
  };

  // Метод Адамса (3-го порядка)
  const solveAdams = (h) => {
    // Сначала получаем первые 3 точки методом Рунге-Кутты
    const startPoints = solveRKF(h).slice(0, 4);
    const solution = [...startPoints];
    
    let t = startPoints[3].t;
    let x = startPoints[3].x;
    let v = startPoints[3].v;
    let a = startPoints[3].a;
    
    const fValues = startPoints.map(p => f(p.t, p.x, p.v, p.a) / params.m);
    
    while (t <= 1) {
      // Прогноз
      const aPred = a + h*(23*fValues[3] - 16*fValues[2] + 5*fValues[1])/12;
      const vPred = v + h*(23*a - 16*solution[solution.length-2].a + 5*solution[solution.length-3].a)/12;
      const xPred = x + h*(23*v - 16*solution[solution.length-2].v + 5*solution[solution.length-3].v)/12;
      
      // Коррекция
      const fPred = f(t + h, xPred, vPred, aPred) / params.m;
      const aNew = a + h*(5*fPred + 8*fValues[3] - fValues[2])/12;
      const vNew = v + h*(5*aNew + 8*a - solution[solution.length-2].a)/12;
      const xNew = x + h*(5*vNew + 8*v - solution[solution.length-2].v)/12;
      const fNew = f(t + h, xNew, vNew, aNew) / params.m;
      
      // Обновляем значения
      t += h;
      x = xNew;
      v = vNew;
      a = aNew;
      
      // Сдвигаем массив предыдущих значений
      fValues.shift();
      fValues.push(fNew);
      
      solution.push({ t, x, v, a });
    }
    
    return solution;
  };

  // Метод Дормана-Принса (DOPRI5)
  const solveDP = (h) => {
    const solution = [];
    let t = 0;
    let x = initialConditions.x;
    let v = initialConditions.v;
    let a = initialConditions.a;
    
    solution.push({ t, x, v, a });

    while (t <= 1) {
      // Коэффициенты Дормана-Принса 5(4)
      const k1 = h * v;
      const l1 = h * a;
      const m1 = h * f(t, x, v, a) / params.m;

      const k2 = h * (v + l1/5);
      const l2 = h * (a + m1/5);
      const m2 = h * f(t + h/5, x + k1/5, v + l1/5, a + m1/5) / params.m;

      const k3 = h * (v + 3*l1/40 + 9*l2/40);
      const l3 = h * (a + 3*m1/40 + 9*m2/40);
      const m3 = h * f(t + 3*h/10, x + 3*k1/40 + 9*k2/40, v + 3*l1/40 + 9*l2/40, a + 3*m1/40 + 9*m2/40) / params.m;

      const k4 = h * (v + 44*l1/45 - 56*l2/15 + 32*l3/9);
      const l4 = h * (a + 44*m1/45 - 56*m2/15 + 32*m3/9);
      const m4 = h * f(t + 4*h/5, x + 44*k1/45 - 56*k2/15 + 32*k3/9, 
                        v + 44*l1/45 - 56*l2/15 + 32*l3/9, a + 44*m1/45 - 56*m2/15 + 32*m3/9) / params.m;

      const k5 = h * (v + 19372*l1/6561 - 25360*l2/2187 + 64448*l3/6561 - 212*l4/729);
      const l5 = h * (a + 19372*m1/6561 - 25360*m2/2187 + 64448*m3/6561 - 212*m4/729);
      const m5 = h * f(t + 8*h/9, x + 19372*k1/6561 - 25360*k2/2187 + 64448*k3/6561 - 212*k4/729,
                        v + 19372*l1/6561 - 25360*l2/2187 + 64448*l3/6561 - 212*l4/729, 
                        a + 19372*m1/6561 - 25360*m2/2187 + 64448*m3/6561 - 212*m4/729) / params.m;

      const k6 = h * (v + 9017*l1/3168 - 355*l2/33 + 46732*l3/5247 + 49*l4/176 - 5103*l5/18656);
      const l6 = h * (a + 9017*m1/3168 - 355*m2/33 + 46732*m3/5247 + 49*m4/176 - 5103*m5/18656);
      const m6 = h * f(t + h, x + 9017*k1/3168 - 355*k2/33 + 46732*k3/5247 + 49*k4/176 - 5103*k5/18656,
                        v + 9017*l1/3168 - 355*l2/33 + 46732*l3/5247 + 49*l4/176 - 5103*l5/18656,
                        a + 9017*m1/3168 - 355*m2/33 + 46732*m3/5247 + 49*m4/176 - 5103*m5/18656) / params.m;

      const k7 = h * (v + 35*l1/384 + 500*l3/1113 + 125*l4/192 - 2187*l5/6784 + 11*l6/84);
      const l7 = h * (a + 35*m1/384 + 500*m3/1113 + 125*m4/192 - 2187*m5/6784 + 11*m6/84);
      
      // Новые значения (5-го порядка)
      const xNew = x + 35*k1/384 + 500*k3/1113 + 125*k4/192 - 2187*k5/6784 + 11*k6/84;
      const vNew = v + 35*l1/384 + 500*l3/1113 + 125*l4/192 - 2187*l5/6784 + 11*l6/84;
      const aNew = a + 35*m1/384 + 500*m3/1113 + 125*m4/192 - 2187*m5/6784 + 11*m6/84;

      t += h;
      x = xNew;
      v = vNew;
      a = aNew;
      
      solution.push({ t, x, v, a });
    }
    
    return solution;
  };

  // Обработчик нажатия кнопки "Решить"
  const handleSolve = () => {
    setIsCalculating(true);
    
    // Имитация асинхронного вычисления
    setTimeout(() => {
      let solution;
      switch(method) {
        case 'rkf':
          solution = solveRKF(stepSize);
          break;
        case 'adams':
          solution = solveAdams(stepSize);
          break;
        case 'dormand-prince':
          solution = solveDP(stepSize);
          break;
        case 'finite-difference':
          solution = solveFiniteDifference(stepSize);
          break;
        default:
          solution = [];
      }
      
      // Находим значение при t=1
      const lastPoint = solution.find(p => Math.abs(p.t - 1) < stepSize/2);
      
      // Подготавливаем данные для графика
      const chartData = {
        labels: solution.map(p => p.t.toFixed(3)),
        datasets: [
          {
            label: 'Отклонение x(t)',
            data: solution.map(p => p.x),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }
        ]
      };
      
      setResult(lastPoint ? lastPoint.x : null);
      setChartData(chartData);
      setIsCalculating(false);
    }, 100);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Решение задачи о движении балки</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Уравнение движения:</h2>
        <p>m·x'''(t) + k·x'(t) + c·x³(t) = F₀·cos(ωt)</p>
        <p>где m = {params.m}, k = {params.k}, c = {params.c}, F₀ = {params.F0}, ω = {params.omega.toFixed(2)}</p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Начальные условия:</h2>
        <p>x(0) = {initialConditions.x}, x'(0) = {initialConditions.v}, x''(0) = {initialConditions.a}</p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Параметры решения:</h2>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div>
            <label htmlFor="method">Метод: </label>
            <select 
              id="method" 
              value={method} 
              onChange={(e) => setMethod(e.target.value)}
              style={{ padding: '5px' }}
            >
              <option value="rkf">Рунге-Кутты-Фельдберга</option>
              <option value="adams">Адамса</option>
              <option value="dormand-prince">Дорман-Принс</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="step">Шаг интегрирования: </label>
            <input 
              id="step" 
              type="number" 
              min="0.001" 
              max="0.1" 
              step="0.001" 
              value={stepSize} 
              onChange={(e) => setStepSize(parseFloat(e.target.value))}
              style={{ padding: '5px', width: '80px' }}
            />
          </div>
        </div>
      </div>
      
      <button 
        onClick={handleSolve}
        disabled={isCalculating}
        style={{ 
          padding: '10px 20px', 
          backgroundColor: isCalculating ? '#ccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isCalculating ? 'not-allowed' : 'pointer'
        }}
      >
        {isCalculating ? 'Вычисление...' : 'Решить'}
      </button>
      
      {result !== null && (
        <div style={{ marginTop: '30px' }}>
          <h2>Результат:</h2>
          <p>Отклонение при t = 1 с: <strong>{result.toFixed(6)}</strong> м</p>
          
          {chartData && (
            <div style={{ marginTop: '30px' }}>
              <h3>График отклонения балки:</h3>
              <div style={{ height: '400px' }}>
                <Line 
                  data={chartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: 'Время, с'
                        }
                      },
                      y: {
                        title: {
                          display: true,
                          text: 'Отклонение, м'
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BeamSolver;