import './App.css'
import {Route, Routes} from 'react-router-dom'
import {Header} from './components/layout/Header'

function HomePage() {
    return <h1>Home</h1>
}

function AboutPage() {
    return <h1>About</h1>
}

function ContactPage() {
    return <h1>Contact</h1>
}

function App() {
    return (
        <>
            <Header/>
            <main>
                <Routes>
                    <Route path="/" element={<HomePage/>}/>
                    <Route path="/about" element={<AboutPage/>}/>
                    <Route path="/contact" element={<ContactPage/>}/>
                </Routes>
            </main>
        </>
    )
}

export default App
