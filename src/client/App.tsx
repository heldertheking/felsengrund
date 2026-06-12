import { useState, useEffect } from 'react';

function App() {
    const [files, setFiles] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        const res = await fetch('/api/files');
        const data: string[] = await res.json();
        setFiles(data);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        await fetch(`/api/files/${file.name}`, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
        });
        setUploading(false);
        fetchFiles();
    };

    return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
            <h1>Felsengrund</h1>
            <p>React + Cloudflare Worker + R2</p>

            <input type="file" onChange={handleUpload} disabled={uploading} />
            {uploading && <span> Uploading…</span>}

            <h2>Files in R2</h2>
            <ul>
                {files.map((f) => (
                    <li key={f}>
                        <a href={`/api/files/${f}`} target="_blank" rel="noreferrer">
                            {f}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default App;
