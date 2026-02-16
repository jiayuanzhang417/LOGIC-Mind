import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import './App.css';

const rgbToHex = (rgb) => {
  if (!rgb || typeof rgb !== 'string') return '#ffffff';
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return '#ffffff';
  const [r, g, b] = match;
  return "#" + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join("");
};
function App() {
  const cyRef = useRef(null);
  const cyInstance = useRef(null);
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([
    { id: 1, title: 'React Lifecycle', timestamp: '2026-02-15' },
    { id: 2, title: 'Flask Backend Architecture', timestamp: '2026-02-16' }
  ]);
  const [layoutType, setLayoutType] = useState('cose');
  const [inputText, setInputText] = useState("");
  const [selectedElement, setSelectedElement] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [currentFilename, setCurrentFilename] = useState(null);
  const fetchHistoryList = () => {
  fetch('http://127.0.0.1:5000/list_history')
    .then(res => res.json())
    .then(data => setHistory(data))
    .catch(err => console.log("Update history failed"));
};
  const generateGraph = () => {
    if (!inputText.trim()) return;
    fetch('http://127.0.0.1:5000/generate_logic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: inputText })
    })
    .then(res => res.json())
    .then(data => {
      loadLogicData();
      fetchHistoryList();
      setInputText("");
    })
    .catch(err => console.error("Generation failed:", err));
  };
  const recordState = () => {
    const cy = cyInstance.current;
    if (!cy) return;
    const snapshot = cy.elements().map(el => {
      const isNode = el.isNode();
      return {
        group: isNode ? 'nodes' : 'edges',
        data: { ...el.data(), color: el.style(isNode ? 'background-color' : 'line-color'), textColor: el.style('color'), shape: isNode ? el.style('shape') : undefined },
        position: isNode ? { ...el.position() } : undefined
      };
    });
    setUndoStack(prev => [...prev.slice(-19), snapshot]);
  };

  const handleUndo = () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const previousState = newStack.pop();
      setElements(previousState);
      return newStack;
    });
  };

  const loadLogicData = () => {
  fetch(`http://127.0.0.1:5000/data.json?t=${Date.now()}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data) return;

      const formattedNodes = (data.nodes || []).map(n => {
        const d = n.data ? n.data : n;
        return {
          data: {
            ...d,
            color: d.color || '#00d2ff',
            shape: d.shape || 'ellipse'
          },
          position: n.position || undefined
        };
      });

      const formattedEdges = (data.edges || []).map(e => {
        const d = e.data ? e.data : e;
        return {
          data: {
            ...d,
            relationship: d.relationship || d.label || 'link',
            color: (d.color === '#999999' || !d.color) ? '#00ffcc' : d.color,
            curveStyle: (d.curveStyle === 'haystack' || !d.curveStyle) ? 'bezier' : d.curveStyle
          }
        };
      });

      setElements([...formattedNodes, ...formattedEdges]);
    });
};
  const loadSpecificHistory = (filename) => {
    setCurrentFilename(filename);

    fetch(`http://127.0.0.1:5000/load_history/${filename}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data) return;
        const formattedNodes = (data.nodes || []).map(n => ({
          data: {
            ...(n.data || n),
            color: (n.data || n).color || '#00d2ff',
            shape: (n.data || n).shape || 'ellipse'
          },
          position: n.position || undefined
        }));
        const formattedEdges = (data.edges || []).map(e => ({
          data: {
            ...(e.data || e),
            relationship: (e.data || e).relationship || (e.data || e).label || 'link',
            color: (!(e.data || e).color || (e.data || e).color === '#999999') ? '#00ffcc' : (e.data || e).color,
            curveStyle: (e.data || e).curveStyle || 'bezier'
          }
        }));
        setElements([...formattedNodes, ...formattedEdges]);
      })
      .catch(err => {
        console.error("Load history error:", err);
        alert("History file error or not found");
      });
  };
  const deleteHistoryItem = (e, filename) => {
  e.stopPropagation();
  if (!window.confirm("Delete this archive forever?")) return;

  fetch(`http://127.0.0.1:5000/delete_history/${filename}`, {
    method: 'DELETE',
  })
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        fetch('http://127.0.0.1:5000/list_history')
          .then(res => res.json())
          .then(data => setHistory(data));
      }
    });
};
  const renameHistoryItem = (e, item) => {
  e.stopPropagation();
  const newName = window.prompt("Rename Archive:", item.title || "");
  
  if (!newName || newName === item.title) return;

  fetch('http://127.0.0.1:5000/rename_history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: item.filename,
      new_title: newName
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === "success") {
      fetchHistoryList();
    }
  });
};
  const handleManualSave = () => {
  const cy = cyInstance.current;
  if (!cy) return;

  const currentData = {
    filename: currentFilename, 
    nodes: cy.nodes().map(n => ({
      data: {
        ...n.data(),
        label: n.data('label'), 
        color: n.data('color') || rgbToHex(n.style('background-color')),
      },
      position: n.position()
    })),
    edges: cy.edges().map(e => ({
      data: {
        ...e.data(),
        relationship: e.data('relationship') || e.data('label'),
        label: e.data('relationship') || e.data('label'), 
        color: e.data('color') || rgbToHex(e.style('line-color')),
        curveStyle: e.style('curve-style') 
      }
    }))
  };

  fetch('http://127.0.0.1:5000/save_logic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentData)
  })
  .then(res => res.json())
  .then(() => {
    alert("Disk Saved! ✅");
    fetchHistoryList(); 
  })
  .catch(err => console.error("Save failed:", err));
};

const handleManualArchive = () => {
    const cy = cyInstance.current;
    if (!cy) return;
    const archiveName = window.prompt(
      "Enter Archive Name:", 
      `Manual Save ${new Date().toLocaleTimeString()}`
    );
    if (archiveName === null || archiveName.trim() === "") return;
    const currentData = {
      title: archiveName, 
      nodes: cy.nodes().map(n => ({
        data: { 
          ...n.data(), 
          label: n.data('label'),
          color: n.data('color')
        },
        position: n.position()
      })),
      edges: cy.edges().map(e => ({
        data: { 
          ...e.data(), 
          relationship: e.data('relationship') || e.data('label'),
          color: e.data('color'),
          curveStyle: e.style('curve-style')
        }
      }))
    };
    fetch('http://127.0.0.1:5000/save_logic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        fetch('http://127.0.0.1:5000/list_history')
          .then(res => res.json())
          .then(historyData => {
            setHistory(historyData);
            alert(`Archived as: ${archiveName} ✅`);
          });
      } else {
        alert("Error: " + data.message);
      }
    })
    .catch(err => {
      console.error("Archive failed:", err);
      alert("Failed to connect to server.");
    });
  };
  useEffect(() => {
    if (!cyRef.current) return;
    cyInstance.current = cytoscape({
      container: cyRef.current,
      selectionType: 'single',
      minZoom: 0.2,
      maxZoom: 2.5,
      style: [
        {
          selector: 'node',
          style: {
            'text-outline-width': 2,
            'text-outline-color': '#000000',
            'label': 'data(label)',
            'shape': (el) => el.data('shape') || el.style('shape') || 'ellipse',
            'background-color': (el) => el.data('color') || '#00d2ff',
            'color': (el) => el.data('textColor') || '#fff',
            'font-size': '12px',
            'text-valign': 'center',
            'width': 65,
            'height': 65,
            'active-bg-opacity': 0,
            'overlay-opacity': 0,
            'overlay-padding': 0
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#a855f7',
            'z-index': 9999
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': (el) => {
              const c = el.data('color');
              return (!c || c === '#999999') ? '#00ffcc' : c;
            },
            'target-arrow-color': (el) => {
              const c = el.data('color');
              return (!c || c === '#999999') ? '#00ffcc' : c;
            },
            'target-arrow-shape': 'triangle',
            'curve-style': (el) => el.data('curveStyle') || el.style('curve-style') || 'bezier',
            'label': (el) => el.data('relationship') || el.data('label') || '',
            'color': (el) => el.data('textColor') || '#ffffff',
            'font-size': '10px',
            'text-background-opacity': 0.7,
            'text-background-color': '#050a10'
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 5,
            'target-arrow-color': '#a855f7',
            'z-index': 999
          }
        }
      ],
      layout: { name: layoutType, animate: true }
    });

    const cy = cyInstance.current;
    let sourceNode = null;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    cy.on('tap', (evt) => {
      if (evt.target === cy) { 
        setSelectedElement(null); 
        if (sourceNode) { sourceNode.removeStyle(); sourceNode = null; } 
      } else { 
        setSelectedElement(evt.target); 
      }
    });
    cy.on('cxttap', 'node', (evt) => {
      const target = evt.target;
      if (!sourceNode) { 
        sourceNode = target; 
        target.style({'border-width': 4, 'border-color': '#fffa00'}); 
      } else {
        if (sourceNode !== target) {
          recordState();
          cy.add({ 
            group: 'edges', 
            data: { 
              id: `edge_${Date.now()}`, 
              source: sourceNode.id(), 
              target: target.id(), 
              relationship: 'link',
              color: '#00ffcc',
              curveStyle: 'bezier'
            } 
          });
        }
        sourceNode.removeStyle(); 
        sourceNode = null;
      }
    });
    cy.on('cxttap', 'edge', (evt) => {
     const edge = evt.target;
     if (window.confirm(`Delete link?`)) {
       recordState();
       edge.remove();
       setSelectedElement(null);
     }
   });
   
    cy.on('dblclick', (evt) => {
      const target = evt.target;

      if (target === cy) {
        const label = window.prompt("New Node Name:");
        if (label) {
          recordState();
          cy.add({
            group: 'nodes',
            data: { id: `node_${Date.now()}`, label: label },
            position: evt.position
          });
        }
      } else if (target.isNode()) {
        const l = window.prompt("Edit Name:", target.data('label'));
        if (l) { 
          recordState(); 
          target.data('label', l); 
        }
      }
        else if (target.isEdge()) {
    const currentLabel = target.data('relationship') || target.data('label') || "";
    const newLabel = window.prompt("Edit Link Name:", currentLabel);
    
    if (newLabel !== null) {
      recordState();
      target.data('relationship', newLabel);
      target.data('label', newLabel); 
    }
  }
    });
    cy.on('dragfree', 'node', () => recordState());
    fetch('http://127.0.0.1:5000/list_history')
      .then(res => res.json())
      .then(data => setHistory(data))
      .catch(err => console.log("Backend not support history yet"));
    loadLogicData();

    return () => { 
      if (cyInstance.current) {
        cyInstance.current.off('dblclick tap cxttap dragfree');
        cyInstance.current.destroy(); 
      }
      window.removeEventListener('keydown', handleKeyDown); 
    };
  }, [layoutType]);
  useEffect(() => {
    if (cyInstance.current && elements.length > 0) {
      const cy = cyInstance.current;
      cy.resize(); 
      cy.batch(() => { cy.elements().remove(); cy.add(elements); });
      const hasPos = elements.some(el => el.position && el.position.x !== undefined);
      cy.layout({ name: hasPos ? 'preset' : layoutType, fit: true, padding: 100 }).run();
    }
  }, [elements, layoutType]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#050a10', color: 'white', overflow: 'hidden', fontFamily: 'sans-serif' }}>
<aside style={{ width: '280px', backgroundColor: '#0f172a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', zIndex: 60 }}>
  <div style={{ padding: '20px', borderBottom: '1px solid #1e293b' }}>
    <h2 style={{ fontSize: '18px', color: '#00d2ff', margin: 0, letterSpacing: '1px' }}>LOGIC FLOW</h2>
  </div>
  <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 10px' }}>
      <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', letterSpacing: '0.5px' }}>HISTORY</label>
      <button 
        onClick={handleManualArchive}
        style={{ background: '#00d2ff15', border: '1px solid #00d2ff', color: '#00d2ff', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
      >
        + ARCHIVE
      </button>
    </div>

    {history.map(item => (
      <div key={item.id} onClick={() => item.filename && loadSpecificHistory(item.filename)} style={{ padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '6px', backgroundColor: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, marginRight: '10px', overflow: 'hidden' }}>
          <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {item.title || "Untitled Save"}
          </div>
          <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>{item.id}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={(e) => renameHistoryItem(e, item)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>✎</button>
          <button onClick={(e) => deleteHistoryItem(e, item.filename)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>✕</button>
        </div>
      </div>
    ))}
  </div>
  <div style={{ padding: '20px', borderTop: '1px solid #1e293b', backgroundColor: '#020617' }}>
    <button 
      onClick={() => { 
        if(window.confirm("Clear all elements on canvas?")) {
          if (cyInstance.current) { cyInstance.current.elements().remove(); }
          setElements([]); 
          setCurrentFilename(null);
          setSelectedElement(null);
        }
      }}
      style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
    >
      CLEAR CANVAS
    </button>
  </div>
</aside>
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div ref={cyRef} style={{ width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '700px', backgroundColor: '#1e293b', borderRadius: '16px', padding: '16px', border: '1px solid #334155', zIndex: 10, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <textarea 
            style={{ width: '100%', background: 'none', border: 'none', color: 'white', outline: 'none', resize: 'none', minHeight: '60px' }} 
            placeholder="Type your thoughts..." 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
            <button onClick={handleUndo} style={{ backgroundColor: '#334155', color: '#94a3b8', border: 'none', padding: '6px 12px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px' }}>UNDO</button>
            <button onClick={handleManualSave} style={{ backgroundColor: '#334155', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '15px', cursor: 'pointer', fontSize: '12px' }}>SAVE</button>
            <button onClick={generateGraph} style={{ background: 'linear-gradient(45deg, #00d2ff, #3a7bd5)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Mind Map</button>
          </div>
        </div>
      </main>
      {selectedElement && (
  <aside style={{ width: '260px', backgroundColor: '#0f172a', borderLeft: '1px solid #1e293b', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 50 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3 style={{ color: '#00d2ff', fontSize: '14px', margin: 0 }}>STYLE EDITOR</h3>
      <button onClick={() => setSelectedElement(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>✕</button>
    </div>

    <hr style={{ border: 'none', borderTop: '1px solid #1e293b', margin: '0' }} />
    {selectedElement.isNode() ? (
      <div>
        <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px' }}>NODE SHAPE</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
          {['ellipse', 'rectangle', 'diamond', 'triangle'].map(s => (
            <button key={s} onClick={() => { recordState(); selectedElement.data('shape', s); selectedElement.style('shape', s); }} style={{ padding: '5px', fontSize: '11px', backgroundColor: selectedElement.data('shape') === s ? '#3a7bd5' : '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '4px', cursor: 'pointer' }}>{s.toUpperCase()}</button>
          ))}
        </div>
      </div>
    ) : (
      <div>
        <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px' }}>LINE STYLE</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
          {['bezier', 'straight', 'taxi', 'haystack'].map(s => (
            <button key={s} onClick={() => { recordState(); selectedElement.data('curveStyle', s); selectedElement.style('curve-style', s); }} style={{ padding: '5px', fontSize: '11px', backgroundColor: (selectedElement.data('curveStyle') === s || selectedElement.style('curve-style') === s) ? '#3a7bd5' : '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '4px', cursor: 'pointer' }}>{s.toUpperCase()}</button>
          ))}
        </div>
      </div>
    )}
    <div>
      <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px' }}>
        {selectedElement.isNode() ? 'QUICK COLORS' : 'LINK COLORS'}
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#00ffcc', '#ffffff', '#747d8c'].map(c => (
          <div 
            key={c} 
            onClick={() => { 
              recordState(); 
              selectedElement.data('color', c); 
              selectedElement.style(selectedElement.isNode() ? 'background-color' : 'line-color', c);
              if(!selectedElement.isNode()) selectedElement.style('target-arrow-color', c);
            }} 
            style={{ 
              width: '28px', height: '28px', backgroundColor: c, borderRadius: '50%', // 改成圆形更像调色盘
              cursor: 'pointer', border: selectedElement.data('color') === c ? '2px solid #00d2ff' : '1px solid #334155',
              boxShadow: selectedElement.data('color') === c ? '0 0 8px #00d2ff' : 'none'
            }} 
          />
        ))}
      </div>
    </div>
    <div>
      <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px' }}>CUSTOM COLOR</label>
      <input 
        type="color" 
        value={rgbToHex(selectedElement.style(selectedElement.isNode() ? 'background-color' : 'line-color'))} 
        onChange={(e) => { 
          selectedElement.data('color', e.target.value); 
          selectedElement.style(selectedElement.isNode() ? 'background-color' : 'line-color', e.target.value);
          if(!selectedElement.isNode()) selectedElement.style('target-arrow-color', e.target.value);
        }} 
        style={{ width: '100%', height: '30px', border: '1px solid #334155', borderRadius: '4px', background: '#1e293b', cursor: 'pointer' }} 
      />
    </div>

    <div>
      <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px' }}>TEXT COLOR</label>
      <input 
        type="color" 
        value={rgbToHex(selectedElement.style('color'))} 
        onChange={(e) => { 
          selectedElement.data('textColor', e.target.value); 
          selectedElement.style('color', e.target.value); 
        }} 
        style={{ width: '100%', height: '30px', border: '1px solid #334155', borderRadius: '4px', background: '#1e293b', cursor: 'pointer' }} 
      />
    </div>

    <button 
      onClick={() => { if(window.confirm("Delete this?")) { recordState(); selectedElement.remove(); setSelectedElement(null); } }} 
      style={{ marginTop: 'auto', padding: '12px', backgroundColor: '#ef444422', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
    >
      DELETE
    </button>
  </aside>
      )}
    </div>
  );
}

export default App;