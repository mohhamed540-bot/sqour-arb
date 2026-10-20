const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'sqour-arb0')));
app.use(express.static(path.join(__dirname, 'sqour-arb1')));
app.use(express.static(path.join(__dirname, 'sqour-arb2')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'sqour-arb0', 'index.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'sqour-arb2', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'sqour-arb1', 'index.html'));
});

// تخزين ملفات تعريف المستخدمين
const userProfiles = {};

io.on('connection', (socket) => {
    console.log('⚡ [اتصال جديد]:', socket.id);

    socket.on('SEND_EVENT_EMIT_SERVER', (packet, callback) => {
        console.log('📥 [حزمة واردة]:', packet);

        if (!packet || !packet.cmd) return;

        // 1. التعامل مع طلب قائمة المتصدرين (WetchTop)
        if (packet.cmd === 'WetchTop') {
            console.log('🏆 [معالجة طلب المتصدرين WetchTop]');
            const topResponse = {
                cmd: 'WetchTop',
                data: [] // قائمة فارغة لمنع حدوث خطأ في الواجهة
            };
            if (typeof callback === 'function') {
                callback(topResponse);
            } else {
                socket.emit('SEND_EVENT_EMIT_SERVER', topResponse);
            }
            return;
        }

        // 2. الرد التأكيدي العام للبقية
        if (typeof callback === 'function') {
            callback({ err: 0, status: 'ok', msg: 'success' });
        }

        // 3. حفظ الملف الشخصي
        if (packet.cmd === 'SEND_EVENT_EMIT_PROFILE') {
            userProfiles[socket.id] = packet.data;
            console.log('👤 [تحديث ملف المستخدم]:', packet.data);
        }

        const p = userProfiles[socket.id] || {};

        const senderUser = {
            id: socket.id,
            name: p.topic || "حسان",
            topic: p.topic || "حسان",
            pic: "/pic/1790799452089.png.webp",
            ico: "",
            co: "ye",
            room: "الرئيسية",
            power: "5",
            col: p.ucol || "#ffff",
            ucol: p.ucol || "#ffff",
            color: p.ucol || "#ffff",
            mcol: p.mcol || "#1a1aff",
            bg: p.bg || "#FFFFFF"
        };

        let responsePacket = {
            cmd: packet.cmd,
            id: socket.id,
            user: senderUser,
            data: packet.data,
            time: new Date().toLocaleTimeString('ar-SA')
        };

        // إعادة بث الحزمة لجميع المتصلين
        io.emit('SEND_EVENT_EMIT_SERVER', responsePacket);
        io.emit('RECEIVE_EVENT', responsePacket);
        io.emit('message', responsePacket);
    });

    socket.onAny((eventName, ...args) => {
        if (eventName !== 'SEND_EVENT_EMIT_SERVER') {
            io.emit(eventName, ...args);
        }
    });

    socket.on('disconnect', () => {
        delete userProfiles[socket.id];
        console.log('❌ [انقطع الاتصال]:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل بانتظار الاتصالات على: http://localhost:${PORT}`);
});
