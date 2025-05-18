import React, { useState } from 'react';
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

import katex from 'katex';
import 'katex/dist/katex.min.css';

function KatexFormula({ tex, displayMode = true }) {
  const html = katex.renderToString(tex, {
    throwOnError: false,
    displayMode,
  });

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function validateNumber(input) {
    const regex = /^\d*\.?\d{0,3}$/;
    if (!regex.test(input)) {
        return false;
    }
    return true;
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Конфигурация задач
const TASKS = {
  beam: {
    title: "Решение задачи о движении планки",
    equation: {
      main: `m \\cdot x'''(t) + k \\cdot x'(t) + c \\cdot x^3(t) = F_0 \\cdot \\cos(\\omega t)`,
      params: (params) => `\\text{где } m = ${params.m},\\ k = ${params.k},\\ c = ${params.c},\\ F_0 = ${params.F0},\\ \\omega = ${params.omega.toFixed(2)}`
    },
    initialConditions: (ic) => `x(0) = ${ic.x},\\quad x'(0) = ${ic.v},\\quad x''(0) = ${ic.a}`,
    params: {
      m: 1,
      k: 0.2,
      c: 4,
      F0: 1,
      omega: 2 * Math.PI
    },
    initialConditionsValues: {
      x: 0.5,
      v: 0,
      a: -1
    },
    yLabel: 'Отклонение, м',
    solutionLabel: 'Отклонение'
  },
  gyroscope: {
    title: "Решение задачи о движении гироскопа с задержкой реакции",
    equation: {
      main: `m \\cdot \\theta'''(t) + \\alpha \\cdot \\theta''(t) + \\beta \\cdot \\sin(\\theta(t)) = 0`,
      params: (params) => `\\text{где } m = ${params.m},\\ \\alpha = ${params.alpha},\\ \\beta = ${params.beta}`
    },
    initialConditions: (ic) => `\\theta(0) = ${ic.x},\\quad \\theta'(0) = ${ic.v},\\quad \\theta''(0) = ${ic.a}`,
    params: {
      m: 3,
      alpha: 1.2,
      beta: 9.8
    },
    initialConditionsValues: {
      x: 0.1,
      v: 0,
      a: -1
    },
    yLabel: 'Угловое отклонение, рад',
    solutionLabel: 'Угловое отклонение'
  }
};

const BeamSolver = () => {
  const [currentTask, setCurrentTask] = useState('beam');
  const taskConfig = TASKS[currentTask];

  // Состояния компонента
  const [stepSize, setStepSize] = useState(0.01);
  const [endTime, setEndTime] = useState(1);
  const [method, setMethod] = useState('rkf');
  const [result, setResult] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [displayedEndTime, setDisplayedEndTime] = useState(endTime);
  const [allSolutions, setAllSolutions] = useState({
    rkf: null,
    dp: null,
    euler: null
  });

  // Функция правой части дифференциального уравнения
  const f = (t, x, v, a) => {
    if (currentTask === 'beam') {
      return (taskConfig.params.F0 * Math.cos(taskConfig.params.omega * t) - 
              taskConfig.params.k * v - 
              taskConfig.params.c * Math.pow(x, 3));
    } else { // gyroscope
      return (-taskConfig.params.alpha * a - 
              taskConfig.params.beta * Math.sin(x)) / taskConfig.params.m;
    }
  };

  // Модифицированный метод Эйлера
  const solveModifiedEuler = (h, tEnd) => {
    const solution = [];
    let t = 0;
    let x = taskConfig.initialConditionsValues.x;
    let v = taskConfig.initialConditionsValues.v;
    let a = taskConfig.initialConditionsValues.a;
    
    solution.push({ t, x, v, a });

    while (t <= tEnd) {
      // прогноз
      const a1 = f(t, x, v, a);
      const v1 = v + h * a;
      const x1 = x + h * v;

      // коррекция
      const a2 = f(t + h, x1, v1, a1);
      const vNew = v + h * (a + a2) / 2;
      const xNew = x + h * (v + v1) / 2;

      t += h;
      x = xNew;
      v = vNew;
      a = (a1 + a2) / 2;
      
      solution.push({ t, x, v, a });
    }
    
    return solution;
  };

  // Метод Рунге-Кутты-Фельдберга
  const solveRKF = (hInit, tEnd, tol = 1e-6) => {
    const solution = [];
    let t = 0;
    let x = taskConfig.initialConditionsValues.x;
    let v = taskConfig.initialConditionsValues.v;
    let a = taskConfig.initialConditionsValues.a;
    
    let h = hInit;
    const hMin = 1e-6;
    const hMax = 0.5;

    solution.push({ t, x, v, a });

    while (t < tEnd) {
      if (t + h > tEnd) h = tEnd - t;

      // Коэффициенты для RKF45
      const k1 = h * v;
      const l1 = h * a;
      const m1 = h * f(t, x, v, a);

      const k2 = h * (v + l1 / 4);
      const l2 = h * (a + m1 / 4);
      const m2 = h * f(t + h / 4, x + k1 / 4, v + l1 / 4, a + m1 / 4);

      const k3 = h * (v + (3 * l1 + 9 * l2) / 32);
      const l3 = h * (a + (3 * m1 + 9 * m2) / 32);
      const m3 = h * f(t + (3 * h) / 8, x + (3 * k1 + 9 * k2) / 32, v + (3 * l1 + 9 * l2) / 32, a + (3 * m1 + 9 * m2) / 32);

      const k4 = h * (v + (1932 * l1 - 7200 * l2 + 7296 * l3) / 2197);
      const l4 = h * (a + (1932 * m1 - 7200 * m2 + 7296 * m3) / 2197);
      const m4 = h * f(
        t + (12 * h) / 13,
        x + (1932 * k1 - 7200 * k2 + 7296 * k3) / 2197,
        v + (1932 * l1 - 7200 * l2 + 7296 * l3) / 2197,
        a + (1932 * m1 - 7200 * m2 + 7296 * m3) / 2197
      );

      const k5 = h * (v + (439 * l1) / 216 - 8 * l2 + (3680 * l3) / 513 - (845 * l4) / 4104);
      const l5 = h * (a + (439 * m1) / 216 - 8 * m2 + (3680 * m3) / 513 - (845 * m4) / 4104);
      const m5 = h * f(
        t + h,
        x + (439 * k1) / 216 - 8 * k2 + (3680 * k3) / 513 - (845 * k4) / 4104,
        v + (439 * l1) / 216 - 8 * l2 + (3680 * l3) / 513 - (845 * l4) / 4104,
        a + (439 * m1) / 216 - 8 * m2 + (3680 * m3) / 513 - (845 * m4) / 4104
      );

      const k6 = h * (v - (8 * l1) / 27 + 2 * l2 - (3544 * l3) / 2565 + (1859 * l4) / 4104 - (11 * l5) / 40);
      const l6 = h * (a - (8 * m1) / 27 + 2 * m2 - (3544 * m3) / 2565 + (1859 * m4) / 4104 - (11 * m5) / 40);
      const m6 = h * f(
        t + h / 2,
        x - (8 * k1) / 27 + 2 * k2 - (3544 * k3) / 2565 + (1859 * k4) / 4104 - (11 * k5) / 40,
        v - (8 * l1) / 27 + 2 * l2 - (3544 * l3) / 2565 + (1859 * l4) / 4104 - (11 * l5) / 40,
        a - (8 * m1) / 27 + 2 * m2 - (3544 * m3) / 2565 + (1859 * m4) / 4104 - (11 * m5) / 40
      );

      // 4-го порядка
      const x4 = x + (25 * k1) / 216 + (1408 * k3) / 2565 + (2197 * k4) / 4104 - (k5) / 5;
      const v4 = v + (25 * l1) / 216 + (1408 * l3) / 2565 + (2197 * l4) / 4104 - (l5) / 5;
      const a4 = a + (25 * m1) / 216 + (1408 * m3) / 2565 + (2197 * m4) / 4104 - (m5) / 5;

      // 5-го порядка
      const x5 = x + (16 * k1) / 135 + (6656 * k3) / 12825 + (28561 * k4) / 56430 - (9 * k5) / 50 + (2 * k6) / 55;
      const v5 = v + (16 * l1) / 135 + (6656 * l3) / 12825 + (28561 * l4) / 56430 - (9 * l5) / 50 + (2 * l6) / 55;
      const a5 = a + (16 * m1) / 135 + (6656 * m3) / 12825 + (28561 * m4) / 56430 - (9 * m5) / 50 + (2 * m6) / 55;

      // Оценка ошибки
      const errX = Math.abs(x5 - x4);
      const errV = Math.abs(v5 - v4);
      const errA = Math.abs(a5 - a4);
      const err = Math.max(errX, errV, errA);

      if (err < tol) {
        t += h;
        x = x5;
        v = v5;
        a = a5;
        solution.push({ t, x, v, a });
      }

      // Адаптация шага
      const delta = 0.84 * Math.pow((tol / (err || 1e-10)), 0.25);
      h = h * Math.min(Math.max(delta, 0.1), 4.0);

      if (h > hMax) h = hMax;
      if (h < hMin) {
        console.warn("Минимальный шаг достигнут, возможна потеря точности");
        h = hMin;
      }
    }

    return solution;
  };

  // Метод Дормана-Принса
  const solveDP = (hInit, tEnd, tol = 1e-6) => {
    const solution = [];
    let t = 0;
    let h = hInit;
    let x = taskConfig.initialConditionsValues.x;
    let v = taskConfig.initialConditionsValues.v;
    let a = taskConfig.initialConditionsValues.a;

    solution.push({ t, x, v, a });

    while (t < tEnd) {
      if (t + h > tEnd) h = tEnd - t;

      const k1 = h * v;
      const l1 = h * a;
      const m1 = h * f(t, x, v, a);

      const k2 = h * (v + l1 / 5);
      const l2 = h * (a + m1 / 5);
      const m2 = h * f(t + h / 5, x + k1 / 5, v + l1 / 5, a + m1 / 5);

      const k3 = h * (v + 3 * l1 / 40 + 9 * l2 / 40);
      const l3 = h * (a + 3 * m1 / 40 + 9 * m2 / 40);
      const m3 = h * f(
        t + 3 * h / 10,
        x + 3 * k1 / 40 + 9 * k2 / 40,
        v + 3 * l1 / 40 + 9 * l2 / 40,
        a + 3 * m1 / 40 + 9 * m2 / 40
      );

      const k4 = h * (v + 44 * l1 / 45 - 56 * l2 / 15 + 32 * l3 / 9);
      const l4 = h * (a + 44 * m1 / 45 - 56 * m2 / 15 + 32 * m3 / 9);
      const m4 = h * f(
        t + 4 * h / 5,
        x + 44 * k1 / 45 - 56 * k2 / 15 + 32 * k3 / 9,
        v + 44 * l1 / 45 - 56 * l2 / 15 + 32 * l3 / 9,
        a + 44 * m1 / 45 - 56 * m2 / 15 + 32 * m3 / 9
      );

      const k5 = h * (
        v + 19372 * l1 / 6561 - 25360 * l2 / 2187 + 64448 * l3 / 6561 - 212 * l4 / 729
      );
      const l5 = h * (
        a + 19372 * m1 / 6561 - 25360 * m2 / 2187 + 64448 * m3 / 6561 - 212 * m4 / 729
      );
      const m5 = h * f(
        t + 8 * h / 9,
        x + 19372 * k1 / 6561 - 25360 * k2 / 2187 + 64448 * k3 / 6561 - 212 * k4 / 729,
        v + 19372 * l1 / 6561 - 25360 * l2 / 2187 + 64448 * l3 / 6561 - 212 * l4 / 729,
        a + 19372 * m1 / 6561 - 25360 * m2 / 2187 + 64448 * m3 / 6561 - 212 * m4 / 729
      );

      const k6 = h * (
        v + 9017 * l1 / 3168 - 355 * l2 / 33 + 46732 * l3 / 5247 + 49 * l4 / 176 - 5103 * l5 / 18656
      );
      const l6 = h * (
        a + 9017 * m1 / 3168 - 355 * m2 / 33 + 46732 * m3 / 5247 + 49 * m4 / 176 - 5103 * m5 / 18656
      );
      const m6 = h * f(
        t + h,
        x + 9017 * k1 / 3168 - 355 * k2 / 33 + 46732 * k3 / 5247 + 49 * k4 / 176 - 5103 * k5 / 18656,
        v + 9017 * l1 / 3168 - 355 * l2 / 33 + 46732 * l3 / 5247 + 49 * l4 / 176 - 5103 * l5 / 18656,
        a + 9017 * m1 / 3168 - 355 * m2 / 33 + 46732 * m3 / 5247 + 49 * m4 / 176 - 5103 * m5 / 18656
      );

      const k7 = h * (
        v + 35 * l1 / 384 + 500 * l3 / 1113 + 125 * l4 / 192 - 2187 * l5 / 6784 + 11 * l6 / 84
      );
      const l7 = h * (
        a + 35 * m1 / 384 + 500 * m3 / 1113 + 125 * m4 / 192 - 2187 * m5 / 6784 + 11 * m6 / 84
      );
      const m7 = h * f(
        t + h,
        x + 35 * k1 / 384 + 500 * k3 / 1113 + 125 * k4 / 192 - 2187 * k5 / 6784 + 11 * k6 / 84,
        v + 35 * l1 / 384 + 500 * l3 / 1113 + 125 * l4 / 192 - 2187 * l5 / 6784 + 11 * l6 / 84,
        a + 35 * m1 / 384 + 500 * m3 / 1113 + 125 * m4 / 192 - 2187 * m5 / 6784 + 11 * m6 / 84
      );

      // Основное решение 5-го порядка
      const x5 = x + 35 * k1 / 384 + 500 * k3 / 1113 + 125 * k4 / 192 - 2187 * k5 / 6784 + 11 * k6 / 84;
      const v5 = v + 35 * l1 / 384 + 500 * l3 / 1113 + 125 * l4 / 192 - 2187 * l5 / 6784 + 11 * l6 / 84;
      const a5 = a + 35 * m1 / 384 + 500 * m3 / 1113 + 125 * m4 / 192 - 2187 * m5 / 6784 + 11 * m6 / 84;

      // Вспомогательное решение 4-го порядка
      const x4 = x + 5179 * k1 / 57600 + 7571 * k3 / 16695 + 393 * k4 / 640 - 92097 * k5 / 339200 + 187 * k6 / 2100 + k7 / 40;
      const v4 = v + 5179 * l1 / 57600 + 7571 * l3 / 16695 + 393 * l4 / 640 - 92097 * l5 / 339200 + 187 * l6 / 2100 + l7 / 40;
      const a4 = a + 5179 * m1 / 57600 + 7571 * m3 / 16695 + 393 * m4 / 640 - 92097 * m5 / 339200 + 187 * m6 / 2100 + m7 / 40;

      // Оценка ошибки
      const err = Math.max(Math.abs(x5 - x4), Math.abs(v5 - v4), Math.abs(a5 - a4));
      const safety = 0.9;
      const minScale = 0.1;
      const maxScale = 4.0;

      if (err <= tol) {
        t += h;
        x = x5;
        v = v5;
        a = a5;
        solution.push({ t, x, v, a });
      }

      // Адаптивное изменение шага
      const scale = safety * Math.pow(tol / (err || 1e-10), 0.2);
      h *= Math.max(minScale, Math.min(maxScale, scale));
    }

    return solution;
  };

  // Создание данных для графика
  const createChartData = (solution, methodName) => {
    if (!solution) return null;
    
    const filteredSolution = solution.filter(p => p.t <= endTime + stepSize / 10);
    
    return {
      labels: filteredSolution.map(p => p.t.toFixed(3)),
      datasets: [{
        label: `${taskConfig.solutionLabel} (${methodName})`,
        data: filteredSolution.map(p => p.x),
        borderColor: methodName === 'Рунге-Кутты-Фельдберга' ? 'rgb(255, 99, 132)' :
                   methodName === 'Дорман-Принс' ? 'rgb(54, 162, 235)' :
                   'rgb(255, 159, 64)',
        tension: 0.1
      }]
    };
  };

  // Обработчик нажатия кнопки "Решить"
  const handleSolve = () => {
    if ((stepSize <= 0 || stepSize > 0.5 || endTime <= 0 || endTime > 3) || 
        (validateNumber(stepSize) !== true) || 
        (validateNumber(endTime) !== true) || 
        (stepSize > endTime)) {
      alert('Недопустимые значения шага или времени!');
      return;
    }

    setDisplayedEndTime(endTime);
    setIsCalculating(true);
    
    setTimeout(() => {
      const rkfSolution = solveRKF(stepSize, endTime);
      const dpSolution = solveDP(stepSize, endTime);
      const eulerSolution = solveModifiedEuler(stepSize, endTime);
      
      const findLastPoint = (solution) => {
        const exactPoint = solution.find(p => Math.abs(p.t - endTime) < 1e-10);
        if (exactPoint) return exactPoint;
        
        const pointsBeforeEnd = solution.filter(p => p.t <= endTime);
        return pointsBeforeEnd[pointsBeforeEnd.length - 1] || null;
      };
      
      const rkfPoint = findLastPoint(rkfSolution);
      const dpPoint = findLastPoint(dpSolution);
      const eulerPoint = findLastPoint(eulerSolution);
      
      const calculateDeviation = (value) => {
        if (!dpPoint || !value) return null;
        return Math.abs((value - dpPoint.x) / dpPoint.x * 100).toFixed(4);
      };
      
      setComparisonResults({
        stepSize,
        endTime,
        methods: {
          dp: {
            value: dpPoint ? dpPoint.x.toFixed(6) : null,
            deviation: "0.0000"
          },
          rkf: {
            value: rkfPoint ? rkfPoint.x.toFixed(6) : null,
            deviation: calculateDeviation(rkfPoint?.x)
          },
          euler: {
            value: eulerPoint ? eulerPoint.x.toFixed(6) : null,
            deviation: calculateDeviation(eulerPoint?.x)
          }
        }
      });
      
      let currentSolution;
      switch(method) {
        case 'rkf': currentSolution = rkfSolution; break;
        case 'dormand-prince': currentSolution = dpSolution; break;
        case 'euler': currentSolution = eulerSolution; break;
        default: currentSolution = [];
      }

      const filteredSolution = currentSolution.filter(p => p.t <= endTime + stepSize / 10);
      
      const chartData = {
        labels: filteredSolution.map(p => p.t.toFixed(3)),
        datasets: [{
          label: `${taskConfig.solutionLabel} (0 ≤ t ≤ ${endTime})`,
          data: currentSolution.map(p => p.x),
          borderColor: 'rgb(87, 36, 255)',
          tension: 0.1
        }]
      };
      
      setAllSolutions({
        rkf: rkfSolution,
        dp: dpSolution,
        euler: eulerSolution
      });
      
      setResult(dpPoint ? dpPoint.x : null);
      setChartData(chartData);
      setIsCalculating(false);
    }, 100);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div>
        <label htmlFor="task">Задача: </label>
        <select 
            id="task" 
            value={currentTask} 
            onChange={(e) => {
              setCurrentTask(e.target.value);
              setResult(null);
              setChartData(null);
              setComparisonResults(null);
              setAllSolutions({ rkf: null, dp: null, euler: null });
            }}
            style={{ padding: '5px' }}
        >
          <option value="beam">Движение планки</option>
          <option value="gyroscope">Движение гироскопа</option>
        </select>
      </div>
      <h1>{taskConfig.title}</h1>
      <div style={{ marginBottom: '20px' }}>
        <h2>Уравнение движения:</h2>
        <KatexFormula tex={taskConfig.equation.main} />
        <KatexFormula tex={taskConfig.equation.params(taskConfig.params)} />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Начальные условия:</h2>
        <KatexFormula tex={taskConfig.initialConditions(taskConfig.initialConditionsValues)} />
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Параметры решения:</h2>
        <div style={{ display: 'flex', gap: '20px', flexDirection: 'column', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="method">Метод: </label>
            <select 
              id="method" 
              value={method} 
              onChange={(e) => setMethod(e.target.value)}
              style={{ padding: '5px' }}
            >
              <option value="rkf">Рунге-Кутты-Фельдберга</option>
              <option value="dormand-prince">Дорман-Принс</option>
              <option value="euler">Модифицированный Эйлер</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="step">Шаг интегрирования (h): </label>
            <input 
              id="step" 
              type="number" 
              min="0.001" 
              max="0.5" 
              step="0.001" 
              value={stepSize} 
              onChange={(e) => setStepSize(parseFloat(e.target.value))}
              style={{ padding: '5px', width: '80px' }}
            />
          </div>
          
          <div>
            <label htmlFor="endTime">Конечное время (t): </label>
            <input 
              id="endTime" 
              type="number" 
              min="0.1" 
              max="3" 
              step="0.1" 
              value={endTime} 
              onChange={(e) => setEndTime(parseFloat(e.target.value))}
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
          <p>{taskConfig.solutionLabel} при t = {displayedEndTime} с: <strong>{result.toFixed(6)}</strong> {currentTask === 'beam' ? 'м' : 'рад'}</p>
          
          {comparisonResults && (
            <div style={{ marginTop: '20px' }}>
              <h3>Сравнение методов (при t = {displayedEndTime} с):</h3>
              <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: '10px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f2f2f2' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Метод</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Значение {currentTask === 'beam' ? 'x' : 'θ'}({displayedEndTime})</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Отклонение от эталона (%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>Рунге-Кутты-Фельдберга</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{comparisonResults.methods.rkf.value}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{comparisonResults.methods.rkf.deviation}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>Дорман-Принс (эталон)</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{comparisonResults.methods.dp.value}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{comparisonResults.methods.dp.deviation}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>Модифицированный Эйлер</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{comparisonResults.methods.euler.value}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{comparisonResults.methods.euler.deviation}</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
                Шаг интегрирования: {comparisonResults.stepSize}
              </p>
            </div>
          )}
          
          {chartData && (
            <div style={{ marginTop: '30px' }}>
              <h3>График {currentTask === 'beam' ? 'отклонения планки' : 'углового отклонения'} (метод: {
                method === 'rkf' ? 'Рунге-Кутты-Фельдберга' : 
                method === 'dormand-prince' ? 'Дорман-Принс' : 
                'Модифицированный Эйлер'
              }):</h3>
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
                          text: taskConfig.yLabel
                        }
                      }
                    }
                  }}
                />
              </div>

              {/* Графики других методов */}
              {method !== 'rkf' && allSolutions.rkf && (
                <div style={{ marginTop: '40px' }}>
                  <h4>График метода Рунге-Кутты-Фельдберга:</h4>
                  <div style={{ height: '300px' }}>
                    <Line 
                      data={createChartData(allSolutions.rkf, 'Рунге-Кутты-Фельдберга')} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          x: { title: { display: true, text: 'Время, с' } },
                          y: { title: { display: true, text: taskConfig.yLabel } }
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {method !== 'dormand-prince' && allSolutions.dp && (
                <div style={{ marginTop: '40px' }}>
                  <h4>График метода Дорман-Принс:</h4>
                  <div style={{ height: '300px' }}>
                    <Line 
                      data={createChartData(allSolutions.dp, 'Дорман-Принс')} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          x: { title: { display: true, text: 'Время, с' } },
                          y: { title: { display: true, text: taskConfig.yLabel } }
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {method !== 'euler' && allSolutions.euler && (
                <div style={{ marginTop: '40px' }}>
                  <h4>График метода Модифицированный Эйлер:</h4>
                  <div style={{ height: '300px' }}>
                    <Line 
                      data={createChartData(allSolutions.euler, 'Модифицированный Эйлер')} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          x: { title: { display: true, text: 'Время, с' } },
                          y: { title: { display: true, text: taskConfig.yLabel } }
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BeamSolver;