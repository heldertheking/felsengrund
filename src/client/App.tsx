import './App.css'
import {Route, Routes} from 'react-router-dom'
import {Header} from './components/layout/Header'
import {HomePage} from "./home/HomePage.tsx";
import {OffersPage} from "./offers/page/OffersPage.tsx";
import {OfferDetailPage} from "./offers/page/OfferDetailPage.tsx";
import {OffersAdminPage} from "./offers/admin/OffersAdminPage.tsx";
import {OfferEditPage} from "./offers/admin/OfferEditPage.tsx";
import {SubmissionsAdminPage} from "./admin/SubmissionsAdminPage.tsx";
import {AdminAuthProvider} from "./contexts/AdminAuthContext.tsx";
import {LoginModal} from "./components/admin/LoginModal.tsx";
import {RequireAdmin} from "./components/admin/RequireAdmin.tsx";

function AboutPage() {
    return <h1>About</h1>
}

function ContactPage() {
    return <h1>Contact</h1>
}

function App() {
    return (
        <AdminAuthProvider>
            <Header/>
            <main>
                <Routes>
                    <Route path="/" element={<HomePage/>}/>
                    <Route path="/about" element={<AboutPage/>}/>
                    <Route path="/contact" element={<ContactPage/>}/>
                    <Route path="/angebote" element={<OffersPage/>}/>
                    <Route path="/angebote/:guid" element={<OfferDetailPage/>}/>
                    <Route path="/admin" element={<RequireAdmin><OffersAdminPage/></RequireAdmin>}/>
                    <Route path="/admin/offers/:guid" element={<RequireAdmin><OfferEditPage/></RequireAdmin>}/>
                    <Route path="/admin/prayer-wall" element={<RequireAdmin><SubmissionsAdminPage title="Gebetswand" path="prayer-wall"/></RequireAdmin>}/>
                    <Route path="/admin/feedback" element={<RequireAdmin><SubmissionsAdminPage title="Parkplatz" path="feedback"/></RequireAdmin>}/>
                </Routes>
            </main>
            <LoginModal/>
        </AdminAuthProvider>
    )
}

export default App
