// Tạo "Đơn đề nghị khắc dấu" dạng file Word thật (.docx) ngay trên trình duyệt.
// Bố cục bám theo file mẫu gốc (0319755936.doc): A4, lề trên/dưới/trái 2.54cm, lề phải 1.25cm,
// Times New Roman, đầu đơn 12pt đậm, tiêu đề 15pt đậm, nội dung 13pt thường,
// giãn dòng 1.15 + cách sau 8pt (đoạn "Chức vụ" -> "Doanh nghiệp tự chịu..." giãn 1.5).
// Mẫu 0402362264.doc thêm mục "Thông tin ủy quyền và nhận bàn giao" (chữ thường, không in đậm / tô màu).
// Mẫu 0401883419.docx: bỏ dòng trống trước tiêu đề, đổi câu "Do mới thành lập..." => "Hiện tại Công Ty...".
import { zipStore } from './zipStore';

export const OUR_COMPANY_NAME = 'CÔNG TY TNHH THƯƠNG MẠI VÀ KỸ THUẬT TÂM TÍN';

export interface KhacDauDocData {
    taxCode: string;
    companyName: string;
    address: string;
    issueDate: string; // Ngày cấp / ngày thành lập (DD/MM/YYYY)
    issuedBy: string; // Cấp bởi
    representative: string; // Người đại diện theo pháp luật
    position: string; // Chức vụ
    place: string; // Nơi làm đơn
    docDate: Date; // Ngày làm đơn
    authorization?: AuthorizationInfo; // type 'none' hoặc bỏ trống tên => không in mục ủy quyền
}

// Người được ủy quyền và nhận bàn giao dấu: cá nhân (CCCD), đại lý, hoặc không in mục này
export type AuthorizationType = 'individual' | 'agent' | 'none';

export interface AuthorizationInfo {
    type: AuthorizationType;
    name: string; // Họ tên / tên đại lý
    idNumber?: string; // Số CCCD
    idIssueDate?: string; // Ngày cấp CCCD
    idIssuedBy?: string; // Nơi cấp CCCD
    address?: string; // Địa chỉ đại lý
    phone?: string;
}

export const DEFAULT_ID_ISSUED_BY = 'Bộ CA';

// Lấy tỉnh/thành từ cuối địa chỉ: "..., TP Đà Nẵng" / "..., Đà Nẵng" => nơi làm đơn "TP Đà Nẵng",
// cấp bởi "Sở tài chính TP Đà Nẵng" (giống file mẫu); "..., Tỉnh Đồng Nai" => "Đồng Nai", "Sở tài chính tỉnh Đồng Nai"
const CENTRAL_CITIES = ['hà nội', 'hồ chí minh', 'hải phòng', 'đà nẵng', 'cần thơ', 'huế'];

export const deriveLocality = (address: string): { place: string; issuedBy: string } | null => {
    const parts = (address || '').split(',').map(x => x.trim().replace(/\.$/, '')).filter(Boolean);
    if (/^Vi[eệ]t\s*Nam$/i.test(parts[parts.length - 1] || '')) parts.pop();
    const last = parts[parts.length - 1] || '';
    const city = last.match(/^(?:TP|Thành phố)\.?\s*(.+)$/i);
    const name = (city ? city[1] : last).trim();
    if (!name) return null;
    if (city || CENTRAL_CITIES.includes(name.toLowerCase())) {
        return { place: `TP ${name}`, issuedBy: `Sở tài chính TP ${name}` };
    }
    const province = name.match(/^Tỉnh\s+(.+)$/i);
    if (province) return { place: province[1], issuedBy: `Sở tài chính tỉnh ${province[1]}` };
    // Tên tỉnh không có chữ "Tỉnh" (bỏ qua nếu là phường/xã/quận... hoặc có số)
    if (!/^(Phường|Xã|Quận|Huyện|Thị xã|Thị trấn|Việt Nam)/i.test(name) && !/\d/.test(name)) {
        return { place: name, issuedBy: `Sở tài chính tỉnh ${name}` };
    }
    return null;
};

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const BLANK = '......................';
const LINE_NORMAL = 278; // ~1.15 dòng như file mẫu
const LINE_WIDE = 360; // 1.5 dòng

const xmlEsc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const val = (s: string, blank = BLANK) => (s && s.trim() ? s.trim() : blank);
const spaces = (n: number) => ' '.repeat(n);

interface ParaOpts {
    center?: boolean;
    bold?: boolean;
    size?: number; // pt
    line?: number;
}

// Khai báo font ở từng run: Pages/Quick Look bỏ qua font mặc định trong styles.xml
// và tự thay bằng "Times" (lỗi hiển thị dấu tiếng Việt)
const FONT = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>';

const rPr = ({ bold, size = 13 }: ParaOpts) =>
    `<w:rPr>${FONT}${bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/></w:rPr>`;

const authorizationParas = (a?: AuthorizationInfo): string[] => {
    if (!a || a.type === 'none' || !a.name.trim()) return [];
    const opts = { line: LINE_WIDE };
    const lines = ['Thông tin ủy quyền và nhận bàn giao:'];
    if (a.type === 'individual') {
        lines.push(
            `${a.name.trim().toUpperCase()}${spaces(3)}Số CCCD: ${val(a.idNumber || '')}${spaces(2)}` +
                `Ngày cấp: ${val(a.idIssueDate || '', '....../....../..........')} ` +
                `Nơi cấp: ${val(a.idIssuedBy || '', DEFAULT_ID_ISSUED_BY)}`
        );
    } else {
        lines.push(`Đại lý: ${a.name.trim().toUpperCase()}${a.address?.trim() ? `${spaces(3)}Địa chỉ: ${a.address.trim()}` : ''}`);
    }
    if (a.phone?.trim()) lines.push(`Số điện thoại liên hệ: ${a.phone.trim()}`);
    return lines.map(line => para(line, opts));
};

// "\t" trong text => tab của Word
const para = (text: string, opts: ParaOpts = {}) => {
    const props = rPr(opts);
    const runs = text
        .split('\t')
        .map(part => (part ? `<w:r>${props}<w:t xml:space="preserve">${xmlEsc(part)}</w:t></w:r>` : ''))
        .join(`<w:r>${props}<w:tab/></w:r>`);
    return (
        `<w:p><w:pPr><w:spacing w:after="160" w:line="${opts.line || LINE_NORMAL}" w:lineRule="auto"/>` +
        `${opts.center ? '<w:jc w:val="center"/>' : ''}${props}</w:pPr>${runs}</w:p>`
    );
};

const buildDocumentXml = (d: KhacDauDocData) => {
    const day = String(d.docDate.getDate()).padStart(2, '0');
    const month = String(d.docDate.getMonth() + 1).padStart(2, '0');
    const year = d.docDate.getFullYear();
    const name = val(d.companyName.toUpperCase());
    const taxCode = val(d.taxCode);
    const issueDate = val(d.issueDate, '....../....../..........');
    const head = { center: true, size: 12 };
    const title = { center: true, bold: true, size: 15 };
    const wide = { line: LINE_WIDE };

    const body = [
        para('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { ...head, bold: true }),
        para('Độc lập- Tự do- Hạnh phúc', { ...head, bold: true }),
        para(`${spaces(66)}${val(d.place)}, ngày ${day} tháng ${month} năm ${year}`, head),
        para('ĐƠN ĐỀ NGHỊ KHẮC DẤU', title),
        para(`Kính gửi: ${OUR_COMPANY_NAME}`),
        para(`Tên doanh nghiệp: ${name}`),
        para(`Địa chỉ trụ sở chính: ${val(d.address)}`),
        para(`Giấy chứng nhận đăng ký doanh nghiệp số${spaces(3)}:${spaces(3)}${taxCode}`),
        para(`Ngày cấp:${spaces(2)}${issueDate}\tcấp bởi: ${val(d.issuedBy)}`),
        para(`Người đại diện theo pháp luật: Ông/Bà ${val(d.representative.toUpperCase())}`),
        para(`Chức vụ: ${val(d.position.toUpperCase())}`, wide),
        para(
            `${name} được thành lập ngày ${issueDate} theo giấy chứng nhận đăng ký doanh nghiệp số ${taxCode} hoạt động theo Luật Doanh nghiệp.`,
            wide
        ),
        para(
            `Hiện tại Công Ty có nhu cầu khắc dấu tròn Doanh nghiệp. Để tạo điều kiện thuận lợi hoạt động ${name} trong thời gian tới, đề nghị quý cơ quan khắc dấu trong thời gian sớm nhất.`,
            wide
        ),
        para('Hồ sơ đính kèm: GPKD bản gốc + CCCD đại diện pháp luật', wide),
        para('Doanh nghiệp tự chịu trách nhiệm trước pháp luật việc sử dụng con dấu hợp pháp.', wide),
        ...authorizationParas(d.authorization),
        para('Tôi xin chân thành cám ơn!'),
        para(`${spaces(88)}Người đề nghị`),
        para(`${spaces(84)}(Ký, ghi rõ họ tên)`),
    ].join('');

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        body +
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
        '<w:pgMar w:top="1440" w:right="707" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>' +
        '</w:sectPr></w:body></w:document>'
    );
};

const STYLES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr>' +
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>' +
    '<w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN" w:eastAsia="en-US" w:bidi="ar-SA"/>' +
    '</w:rPr></w:rPrDefault>' +
    `<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="${LINE_NORMAL}" w:lineRule="auto"/></w:pPr></w:pPrDefault>` +
    '</w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '</w:styles>';

const SETTINGS_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:defaultTabStop w:val="720"/>' +
    '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
    '</w:settings>';

const CONTENT_TYPES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
    '</Types>';

const ROOT_RELS_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

const DOCUMENT_RELS_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
    '</Relationships>';

export const buildKhacDauDocx = (d: KhacDauDocData): Blob =>
    zipStore(
        [
            { name: '[Content_Types].xml', content: CONTENT_TYPES_XML },
            { name: '_rels/.rels', content: ROOT_RELS_XML },
            { name: 'word/document.xml', content: buildDocumentXml(d) },
            { name: 'word/_rels/document.xml.rels', content: DOCUMENT_RELS_XML },
            { name: 'word/styles.xml', content: STYLES_XML },
            { name: 'word/settings.xml', content: SETTINGS_XML },
        ],
        DOCX_MIME
    );

export const downloadKhacDauDoc = (d: KhacDauDocData) => {
    const url = URL.createObjectURL(buildKhacDauDocx(d));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${d.taxCode || 'don-de-nghi-khac-dau'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
