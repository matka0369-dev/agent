import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Player-app localization. Nothing else in this package reads or provides
 * this context, so `useLang()`'s default (English passthrough, `setLang` a
 * no-op) is exactly what every other portal sees — a component can safely
 * call `t(...)` without caring whether it's mounted under a `LangProvider`
 * at all.
 */
export type Lang = 'en' | 'hi' | 'te' | 'ta' | 'kn' | 'mr';

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'mr', label: 'मराठी' },
];

type Dict = Record<string, string>;

const en: Dict = {
  'lang.title': 'Choose your language',
  'lang.subtitle': 'You can switch this anytime from the menu at the top.',
  'lang.continue': 'Continue',
  'login.usernameLabel': 'Username',
  'login.passwordLabel': 'Password',
  'login.signIn': 'Sign in',
  'login.signingIn': 'Signing in…',
  'login.noSelfSignup': 'Accounts are created by an administrator — there is no self sign-up.',
  'login.back': 'Back',
  'header.signOut': 'Sign out',
  'header.purseTitle': 'Spendable balance',
  'header.language': 'Language',
  'nav.predict': 'Predict',
  'nav.overview': 'Overview',
  'nav.yourRates': 'Your rates',
  'nav.myPredictions': 'My predictions',
  'nav.requestTokens': 'Request tokens',
  'nav.tokenHistory': 'Token history',
  'nav.yourSessions': 'Your sessions',
  'nav.aboutTokens': 'About your tokens',
  'dash.welcome': 'Welcome',
  'dash.subtitle': 'View your account, balance, and prediction activity.',
  'dash.mainBalance': 'Main balance',
  'dash.mainBalanceHint': 'Spent first when you predict',
  'dash.winnings': 'Winnings',
  'dash.winningsHint': 'Where payouts land — spendable once main runs out',
  'dash.account': 'Account',
  'dash.active': 'Active',
  'dash.disabled': 'Disabled',
  'dash.yourAgent': 'Your agent',
  'dash.yourAgentHint': 'Who to contact for support',
  'dash.aboutTokensTitle': 'About your tokens',
  'dash.aboutTokensBody':
    'Tokens are a closed-loop simulation currency. They cannot be purchased, sold, redeemed, transferred, or converted into anything of value, and there are no deposits or withdrawals of any kind. Every change to your balance is recorded in an auditable ledger.',
  'dash.tokenHistoryDesc': 'Every change to your balance.',
  'predict.loading': 'Loading games…',
  'predict.day': 'Day',
  'predict.night': 'Night',
  'predict.backAllGames': 'All games',
  'predict.noGames': "No games are open right now — check back once your Agent's Admin enables one.",
  'predict.notInList': "That game isn't in today's list — it may have been disabled, or the link is stale.",
  'predict.backToGames': 'Back to games',
  'predict.closedForToday': '{name} is closed for today — check back tomorrow.',
  'predict.opensAtInfo':
    "{name}'s open declaration is at {time} — Open/Jodi/Sangam bets close a minute before that; Close bets stay open separately.",
  'predict.openBetsCloseIn': 'Open bets close in:',
  'predict.closeBetsCloseIn': 'Close bets close in:',
  'predict.closedForRound': 'Closed for this round',
  'predict.left': 'left',
  'predict.openGroup': 'Open',
  'predict.closeGroup': 'Close',
  'predict.yourPick': 'Your pick',
  'predict.stake': 'Stake',
  'predict.stakeHint': 'Between {min} and {max}',
  'predict.spendable': 'Spendable: {n} tokens (main first, then winnings)',
  'predict.placed': 'Placed — {number} at {mult}x. New balance: {bal}.',
  'predict.placing': 'Placing…',
  'predict.timeUp': 'Time is up for this type',
  'predict.placePrediction': 'Place prediction',
  'predict.statusOpen': 'Open · closes in {t}',
  'predict.statusUpcoming': 'Opens in {t}',
  'predict.statusClosedToday': 'Closed for today',
  'type.OPEN_SINGLE': 'Single (Open)',
  'type.CLOSE_SINGLE': 'Single (Close)',
  'type.JODI': 'Jodi',
  'type.OPEN_SINGLE_PANA': 'Single Pana (Open)',
  'type.CLOSE_SINGLE_PANA': 'Single Pana (Close)',
  'type.OPEN_DOUBLE_PANA': 'Double Pana (Open)',
  'type.CLOSE_DOUBLE_PANA': 'Double Pana (Close)',
  'type.OPEN_TRIPLE_PANA': 'Triple Pana (Open)',
  'type.CLOSE_TRIPLE_PANA': 'Triple Pana (Close)',
};

const hi: Dict = {
  'lang.title': 'अपनी भाषा चुनें',
  'lang.subtitle': 'आप इसे ऊपर दिए गए मेनू से कभी भी बदल सकते हैं।',
  'lang.continue': 'आगे बढ़ें',
  'login.usernameLabel': 'उपयोगकर्ता नाम',
  'login.passwordLabel': 'पासवर्ड',
  'login.signIn': 'साइन इन करें',
  'login.signingIn': 'साइन इन हो रहा है…',
  'login.noSelfSignup': 'खाते किसी एडमिन द्वारा बनाए जाते हैं — यहाँ खुद रजिस्टर करने की सुविधा नहीं है।',
  'login.back': 'वापस',
  'header.signOut': 'साइन आउट',
  'header.purseTitle': 'खर्च करने योग्य बैलेंस',
  'header.language': 'भाषा',
  'nav.predict': 'प्रेडिक्ट',
  'nav.overview': 'ओवरव्यू',
  'nav.yourRates': 'आपकी दरें',
  'nav.myPredictions': 'मेरी प्रेडिक्शन',
  'nav.requestTokens': 'टोकन का अनुरोध करें',
  'nav.tokenHistory': 'टोकन इतिहास',
  'nav.yourSessions': 'आपके सेशन',
  'nav.aboutTokens': 'टोकन के बारे में',
  'dash.welcome': 'स्वागत है',
  'dash.subtitle': 'अपना खाता, बैलेंस और प्रेडिक्शन गतिविधि देखें।',
  'dash.mainBalance': 'मुख्य बैलेंस',
  'dash.mainBalanceHint': 'प्रेडिक्ट करते समय सबसे पहले इसी से खर्च होता है',
  'dash.winnings': 'जीत की राशि',
  'dash.winningsHint': 'जीत का भुगतान यहाँ आता है — मुख्य बैलेंस खत्म होने के बाद ही खर्च होता है',
  'dash.account': 'खाता',
  'dash.active': 'सक्रिय',
  'dash.disabled': 'निष्क्रिय',
  'dash.yourAgent': 'आपका एजेंट',
  'dash.yourAgentHint': 'सहायता के लिए किससे संपर्क करें',
  'dash.aboutTokensTitle': 'टोकन के बारे में',
  'dash.aboutTokensBody':
    'टोकन एक क्लोज़्ड-लूप सिमुलेशन करेंसी है। इन्हें खरीदा, बेचा, भुनाया, ट्रांसफर या किसी मूल्यवान चीज़ में परिवर्तित नहीं किया जा सकता, और इसमें किसी भी तरह की जमा या निकासी नहीं होती। आपके बैलेंस में हर बदलाव एक ऑडिट-योग्य लेजर में दर्ज किया जाता है।',
  'dash.tokenHistoryDesc': 'आपके बैलेंस में हर बदलाव।',
  'predict.loading': 'गेम लोड हो रहे हैं…',
  'predict.day': 'दिन',
  'predict.night': 'रात',
  'predict.backAllGames': 'सभी गेम',
  'predict.noGames': 'अभी कोई गेम खुला नहीं है — अपने एजेंट के एडमिन द्वारा कोई गेम चालू करने पर वापस देखें।',
  'predict.notInList': 'यह गेम आज की सूची में नहीं है — हो सकता है इसे बंद कर दिया गया हो, या लिंक पुराना हो।',
  'predict.backToGames': 'गेम्स पर वापस जाएं',
  'predict.closedForToday': '{name} आज के लिए बंद है — कल फिर देखें।',
  'predict.opensAtInfo':
    '{name} की ओपन घोषणा {time} बजे होगी — ओपन/जोड़ी/संगम बेट उससे एक मिनट पहले बंद हो जाते हैं; क्लोज बेट अलग से खुले रहते हैं।',
  'predict.openBetsCloseIn': 'ओपन बेट बंद होने में:',
  'predict.closeBetsCloseIn': 'क्लोज बेट बंद होने में:',
  'predict.closedForRound': 'इस राउंड के लिए बंद',
  'predict.left': 'बचा है',
  'predict.openGroup': 'ओपन',
  'predict.closeGroup': 'क्लोज',
  'predict.yourPick': 'आपका नंबर',
  'predict.stake': 'स्टेक',
  'predict.stakeHint': '{min} और {max} के बीच',
  'predict.spendable': 'खर्च करने योग्य: {n} टोकन (पहले मुख्य, फिर जीत की राशि)',
  'predict.placed': 'लगाया गया — {number}, {mult}x पर। नया बैलेंस: {bal}।',
  'predict.placing': 'लगाया जा रहा है…',
  'predict.timeUp': 'इस प्रकार के लिए समय समाप्त हो गया है',
  'predict.placePrediction': 'प्रेडिक्शन लगाएं',
  'predict.statusOpen': 'ओपन · {t} में बंद होगा',
  'predict.statusUpcoming': '{t} में खुलेगा',
  'predict.statusClosedToday': 'आज के लिए बंद',
  'type.OPEN_SINGLE': 'सिंगल (ओपन)',
  'type.CLOSE_SINGLE': 'सिंगल (क्लोज)',
  'type.JODI': 'जोड़ी',
  'type.OPEN_SINGLE_PANA': 'सिंगल पाना (ओपन)',
  'type.CLOSE_SINGLE_PANA': 'सिंगल पाना (क्लोज)',
  'type.OPEN_DOUBLE_PANA': 'डबल पाना (ओपन)',
  'type.CLOSE_DOUBLE_PANA': 'डबल पाना (क्लोज)',
  'type.OPEN_TRIPLE_PANA': 'ट्रिपल पाना (ओपन)',
  'type.CLOSE_TRIPLE_PANA': 'ट्रिपल पाना (क्लोज)',
};

const mr: Dict = {
  'lang.title': 'तुमची भाषा निवडा',
  'lang.subtitle': 'तुम्ही ही वरच्या मेनूमधून कधीही बदलू शकता.',
  'lang.continue': 'पुढे जा',
  'login.usernameLabel': 'युजरनेम',
  'login.passwordLabel': 'पासवर्ड',
  'login.signIn': 'साइन इन करा',
  'login.signingIn': 'साइन इन होत आहे…',
  'login.noSelfSignup': 'खाती अ‍ॅडमिनद्वारे तयार केली जातात — इथे स्वतः नोंदणी करण्याची सुविधा नाही.',
  'login.back': 'मागे',
  'header.signOut': 'साइन आउट',
  'header.purseTitle': 'खर्च करण्यायोग्य शिल्लक',
  'header.language': 'भाषा',
  'nav.predict': 'प्रेडिक्ट',
  'nav.overview': 'आढावा',
  'nav.yourRates': 'तुमचे दर',
  'nav.myPredictions': 'माझ्या प्रेडिक्शन्स',
  'nav.requestTokens': 'टोकन्ससाठी विनंती करा',
  'nav.tokenHistory': 'टोकन इतिहास',
  'nav.yourSessions': 'तुमचे सेशन्स',
  'nav.aboutTokens': 'टोकन्सबद्दल',
  'dash.welcome': 'स्वागत आहे',
  'dash.subtitle': 'तुमचे खाते, शिल्लक आणि प्रेडिक्शन क्रियाकलाप पहा.',
  'dash.mainBalance': 'मुख्य शिल्लक',
  'dash.mainBalanceHint': 'प्रेडिक्ट करताना आधी हीच खर्च होते',
  'dash.winnings': 'जिंकलेली रक्कम',
  'dash.winningsHint': 'पेआउट इथे जमा होतात — मुख्य शिल्लक संपल्यावरच खर्च करता येते',
  'dash.account': 'खाते',
  'dash.active': 'सक्रिय',
  'dash.disabled': 'निष्क्रिय',
  'dash.yourAgent': 'तुमचा एजंट',
  'dash.yourAgentHint': 'मदतीसाठी कोणाशी संपर्क साधावा',
  'dash.aboutTokensTitle': 'टोकन्सबद्दल',
  'dash.aboutTokensBody':
    'टोकन्स ही एक क्लोज्ड-लूप सिम्युलेशन करन्सी आहे. ती विकत घेता, विकता, वटवता, ट्रान्सफर करता किंवा कोणत्याही मूल्यवान गोष्टीत बदलता येत नाही, आणि यात कोणत्याही प्रकारची जमा किंवा पैसे काढण्याची सुविधा नाही. तुमच्या शिल्लकीतील प्रत्येक बदल ऑडिट करण्यायोग्य लेजरमध्ये नोंदवला जातो.',
  'dash.tokenHistoryDesc': 'तुमच्या शिल्लकीतील प्रत्येक बदल.',
  'predict.loading': 'गेम्स लोड होत आहेत…',
  'predict.day': 'दिवस',
  'predict.night': 'रात्र',
  'predict.backAllGames': 'सर्व गेम्स',
  'predict.noGames': 'सध्या कोणताही गेम सुरू नाही — तुमच्या एजंटच्या अ‍ॅडमिनने एखादा गेम सुरू केल्यावर पुन्हा पहा.',
  'predict.notInList': 'हा गेम आजच्या यादीत नाही — तो बंद केला असेल किंवा लिंक जुनी असेल.',
  'predict.backToGames': 'गेम्सकडे परत जा',
  'predict.closedForToday': '{name} आजसाठी बंद आहे — उद्या पुन्हा पहा.',
  'predict.opensAtInfo':
    '{name} ची ओपन घोषणा {time} वाजता होईल — ओपन/जोडी/संगम बेट्स त्याआधी एक मिनिट बंद होतात; क्लोज बेट्स स्वतंत्रपणे सुरू राहतात.',
  'predict.openBetsCloseIn': 'ओपन बेट्स बंद होण्यास:',
  'predict.closeBetsCloseIn': 'क्लोज बेट्स बंद होण्यास:',
  'predict.closedForRound': 'या राउंडसाठी बंद',
  'predict.left': 'शिल्लक',
  'predict.openGroup': 'ओपन',
  'predict.closeGroup': 'क्लोज',
  'predict.yourPick': 'तुमचा नंबर',
  'predict.stake': 'स्टेक',
  'predict.stakeHint': '{min} आणि {max} च्या दरम्यान',
  'predict.spendable': 'खर्च करण्यायोग्य: {n} टोकन्स (आधी मुख्य, मग जिंकलेली रक्कम)',
  'predict.placed': 'लावले — {number}, {mult}x वर. नवीन शिल्लक: {bal}.',
  'predict.placing': 'लावले जात आहे…',
  'predict.timeUp': 'या प्रकारासाठी वेळ संपली आहे',
  'predict.placePrediction': 'प्रेडिक्शन लावा',
  'predict.statusOpen': 'ओपन · {t} मध्ये बंद होईल',
  'predict.statusUpcoming': '{t} मध्ये सुरू होईल',
  'predict.statusClosedToday': 'आजसाठी बंद',
  'type.OPEN_SINGLE': 'सिंगल (ओपन)',
  'type.CLOSE_SINGLE': 'सिंगल (क्लोज)',
  'type.JODI': 'जोडी',
  'type.OPEN_SINGLE_PANA': 'सिंगल पाना (ओपन)',
  'type.CLOSE_SINGLE_PANA': 'सिंगल पाना (क्लोज)',
  'type.OPEN_DOUBLE_PANA': 'डबल पाना (ओपन)',
  'type.CLOSE_DOUBLE_PANA': 'डबल पाना (क्लोज)',
  'type.OPEN_TRIPLE_PANA': 'ट्रिपल पाना (ओपन)',
  'type.CLOSE_TRIPLE_PANA': 'ट्रिपल पाना (क्लोज)',
};

const te: Dict = {
  'lang.title': 'మీ భాష ఎంచుకోండి',
  'lang.subtitle': 'దీన్ని మీరు పైన ఉన్న మెనూ నుండి ఎప్పుడైనా మార్చుకోవచ్చు.',
  'lang.continue': 'కొనసాగించు',
  'login.usernameLabel': 'యూజర్‌నేమ్',
  'login.passwordLabel': 'పాస్‌వర్డ్',
  'login.signIn': 'సైన్ ఇన్ చేయండి',
  'login.signingIn': 'సైన్ ఇన్ అవుతోంది…',
  'login.noSelfSignup': 'ఖాతాలను అడ్మిన్ మాత్రమే సృష్టిస్తారు — స్వయంగా నమోదు చేసుకునే సదుపాయం లేదు.',
  'login.back': 'వెనక్కి',
  'header.signOut': 'సైన్ అవుట్',
  'header.purseTitle': 'ఖర్చు చేయగల బ్యాలెన్స్',
  'header.language': 'భాష',
  'nav.predict': 'ప్రిడిక్ట్',
  'nav.overview': 'ఓవర్‌వ్యూ',
  'nav.yourRates': 'మీ రేట్లు',
  'nav.myPredictions': 'నా ప్రిడిక్షన్‌లు',
  'nav.requestTokens': 'టోకెన్లు కోరండి',
  'nav.tokenHistory': 'టోకెన్ చరిత్ర',
  'nav.yourSessions': 'మీ సెషన్‌లు',
  'nav.aboutTokens': 'టోకెన్ల గురించి',
  'dash.welcome': 'స్వాగతం',
  'dash.subtitle': 'మీ ఖాతా, బ్యాలెన్స్ మరియు ప్రిడిక్షన్ కార్యకలాపాలను చూడండి.',
  'dash.mainBalance': 'ప్రధాన బ్యాలెన్స్',
  'dash.mainBalanceHint': 'మీరు ప్రిడిక్ట్ చేసినప్పుడు ముందుగా ఇదే ఖర్చవుతుంది',
  'dash.winnings': 'గెలుపు మొత్తం',
  'dash.winningsHint': 'చెల్లింపులు ఇక్కడికే వస్తాయి — ప్రధాన బ్యాలెన్స్ అయిపోయాకే ఖర్చు చేయగలరు',
  'dash.account': 'ఖాతా',
  'dash.active': 'యాక్టివ్',
  'dash.disabled': 'డిజేబుల్',
  'dash.yourAgent': 'మీ ఏజెంట్',
  'dash.yourAgentHint': 'సహాయం కోసం ఎవరిని సంప్రదించాలి',
  'dash.aboutTokensTitle': 'టోకెన్ల గురించి',
  'dash.aboutTokensBody':
    'టోకెన్లు ఒక క్లోజ్డ్-లూప్ సిమ్యులేషన్ కరెన్సీ. వీటిని కొనుగోలు చేయడం, అమ్మడం, రిడీమ్ చేయడం, బదిలీ చేయడం లేదా విలువైన దేనిగానైనా మార్చడం సాధ్యం కాదు, మరియు ఎలాంటి డిపాజిట్లు లేదా విత్‌డ్రాలు ఉండవు. మీ బ్యాలెన్స్‌లో జరిగే ప్రతి మార్పు ఆడిట్ చేయగల లెడ్జర్‌లో నమోదవుతుంది.',
  'dash.tokenHistoryDesc': 'మీ బ్యాలెన్స్‌లో జరిగిన ప్రతి మార్పు.',
  'predict.loading': 'గేమ్‌లు లోడ్ అవుతున్నాయి…',
  'predict.day': 'పగలు',
  'predict.night': 'రాత్రి',
  'predict.backAllGames': 'అన్ని గేమ్‌లు',
  'predict.noGames': 'ప్రస్తుతం ఏ గేమ్ తెరిచి లేదు — మీ ఏజెంట్ అడ్మిన్ ఒక గేమ్‌ను ఎనేబుల్ చేసిన తర్వాత మళ్ళీ చూడండి.',
  'predict.notInList': 'ఈ గేమ్ ఈ రోజు జాబితాలో లేదు — దీన్ని డిజేబుల్ చేసి ఉండవచ్చు, లేదా లింక్ పాతదై ఉండవచ్చు.',
  'predict.backToGames': 'గేమ్‌లకు తిరిగి వెళ్ళండి',
  'predict.closedForToday': '{name} ఈ రోజుకు మూసివేయబడింది — రేపు మళ్ళీ చూడండి.',
  'predict.opensAtInfo':
    '{name} యొక్క ఓపెన్ ప్రకటన {time} గంటలకు జరుగుతుంది — ఓపెన్/జోడీ/సంగం బెట్‌లు దానికి ఒక నిమిషం ముందే మూసివేయబడతాయి; క్లోజ్ బెట్‌లు విడిగా తెరిచి ఉంటాయి.',
  'predict.openBetsCloseIn': 'ఓపెన్ బెట్‌లు మూసివేయడానికి:',
  'predict.closeBetsCloseIn': 'క్లోజ్ బెట్‌లు మూసివేయడానికి:',
  'predict.closedForRound': 'ఈ రౌండ్‌కు మూసివేయబడింది',
  'predict.left': 'మిగిలి ఉంది',
  'predict.openGroup': 'ఓపెన్',
  'predict.closeGroup': 'క్లోజ్',
  'predict.yourPick': 'మీ నంబర్',
  'predict.stake': 'స్టేక్',
  'predict.stakeHint': '{min} మరియు {max} మధ్య',
  'predict.spendable': 'ఖర్చు చేయగలిగినది: {n} టోకెన్లు (ముందు ప్రధానం, తర్వాత గెలుపు మొత్తం)',
  'predict.placed': 'పెట్టబడింది — {number}, {mult}x వద్ద. కొత్త బ్యాలెన్స్: {bal}.',
  'predict.placing': 'పెడుతోంది…',
  'predict.timeUp': 'ఈ రకానికి సమయం ముగిసింది',
  'predict.placePrediction': 'ప్రిడిక్షన్ పెట్టండి',
  'predict.statusOpen': 'ఓపెన్ · {t}లో మూసివేయబడుతుంది',
  'predict.statusUpcoming': '{t}లో తెరవబడుతుంది',
  'predict.statusClosedToday': 'ఈ రోజుకు మూసివేయబడింది',
  'type.OPEN_SINGLE': 'సింగిల్ (ఓపెన్)',
  'type.CLOSE_SINGLE': 'సింగిల్ (క్లోజ్)',
  'type.JODI': 'జోడీ',
  'type.OPEN_SINGLE_PANA': 'సింగిల్ పానా (ఓపెన్)',
  'type.CLOSE_SINGLE_PANA': 'సింగిల్ పానా (క్లోజ్)',
  'type.OPEN_DOUBLE_PANA': 'డబుల్ పానా (ఓపెన్)',
  'type.CLOSE_DOUBLE_PANA': 'డబుల్ పానా (క్లోజ్)',
  'type.OPEN_TRIPLE_PANA': 'ట్రిపుల్ పానా (ఓపెన్)',
  'type.CLOSE_TRIPLE_PANA': 'ట్రిపుల్ పానా (క్లోజ్)',
};

const ta: Dict = {
  'lang.title': 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்',
  'lang.subtitle': 'இதை மேலே உள்ள மெனுவில் இருந்து எப்போது வேண்டுமானாலும் மாற்றிக்கொள்ளலாம்.',
  'lang.continue': 'தொடரவும்',
  'login.usernameLabel': 'பயனர்பெயர்',
  'login.passwordLabel': 'கடவுச்சொல்',
  'login.signIn': 'உள்நுழையவும்',
  'login.signingIn': 'உள்நுழைகிறது…',
  'login.noSelfSignup': 'கணக்குகள் நிர்வாகியால் உருவாக்கப்படுகின்றன — சுயமாக பதிவு செய்யும் வசதி இல்லை.',
  'login.back': 'பின்செல்',
  'header.signOut': 'வெளியேறு',
  'header.purseTitle': 'செலவிடக்கூடிய இருப்பு',
  'header.language': 'மொழி',
  'nav.predict': 'ப்ரெடிக்ட்',
  'nav.overview': 'மேலோட்டம்',
  'nav.yourRates': 'உங்கள் விகிதங்கள்',
  'nav.myPredictions': 'எனது ப்ரெடிக்ஷன்கள்',
  'nav.requestTokens': 'டோக்கன்கள் கோரவும்',
  'nav.tokenHistory': 'டோக்கன் வரலாறு',
  'nav.yourSessions': 'உங்கள் அமர்வுகள்',
  'nav.aboutTokens': 'டோக்கன்கள் பற்றி',
  'dash.welcome': 'வரவேற்கிறோம்',
  'dash.subtitle': 'உங்கள் கணக்கு, இருப்பு மற்றும் ப்ரெடிக்ஷன் செயல்பாடுகளைப் பார்க்கவும்.',
  'dash.mainBalance': 'முதன்மை இருப்பு',
  'dash.mainBalanceHint': 'நீங்கள் ப்ரெடிக்ட் செய்யும்போது முதலில் இதிலிருந்தே செலவாகும்',
  'dash.winnings': 'வெற்றித் தொகை',
  'dash.winningsHint': 'பணம் இங்கே வரும் — முதன்மை இருப்பு தீர்ந்த பிறகே செலவிடக்கூடியது',
  'dash.account': 'கணக்கு',
  'dash.active': 'செயலில்',
  'dash.disabled': 'முடக்கப்பட்டது',
  'dash.yourAgent': 'உங்கள் ஏஜெண்ட்',
  'dash.yourAgentHint': 'உதவிக்கு யாரைத் தொடர்புகொள்வது',
  'dash.aboutTokensTitle': 'டோக்கன்கள் பற்றி',
  'dash.aboutTokensBody':
    'டோக்கன்கள் ஒரு closed-loop சிமுலேஷன் நாணயம். இவற்றை வாங்கவோ, விற்கவோ, மாற்றவோ, பரிமாற்றவோ அல்லது மதிப்புள்ள எதுவாகவும் மாற்றவோ முடியாது, மேலும் எந்த வகையான டெபாசிட் அல்லது திரும்பப் பெறுதலும் இல்லை. உங்கள் இருப்பில் ஏற்படும் ஒவ்வொரு மாற்றமும் தணிக்கை செய்யக்கூடிய லெட்ஜரில் பதிவு செய்யப்படும்.',
  'dash.tokenHistoryDesc': 'உங்கள் இருப்பில் ஏற்படும் ஒவ்வொரு மாற்றமும்.',
  'predict.loading': 'விளையாட்டுகள் ஏற்றப்படுகின்றன…',
  'predict.day': 'பகல்',
  'predict.night': 'இரவு',
  'predict.backAllGames': 'அனைத்து விளையாட்டுகள்',
  'predict.noGames':
    'இப்போது எந்த விளையாட்டும் திறந்திருக்கவில்லை — உங்கள் ஏஜெண்டின் நிர்வாகி ஒரு விளையாட்டை இயக்கிய பிறகு மீண்டும் பாருங்கள்.',
  'predict.notInList': 'இந்த விளையாட்டு இன்றைய பட்டியலில் இல்லை — அது முடக்கப்பட்டிருக்கலாம், அல்லது இணைப்பு பழையதாக இருக்கலாம்.',
  'predict.backToGames': 'விளையாட்டுகளுக்குத் திரும்பு',
  'predict.closedForToday': '{name} இன்று மூடப்பட்டுள்ளது — நாளை மீண்டும் பாருங்கள்.',
  'predict.opensAtInfo':
    '{name} இன் ஓப்பன் அறிவிப்பு {time} மணிக்கு நடைபெறும் — ஓப்பன்/ஜோடி/சங்கம் பந்தயங்கள் அதற்கு ஒரு நிமிடம் முன்பே மூடிவிடும்; க்ளோஸ் பந்தயங்கள் தனியாகத் திறந்திருக்கும்.',
  'predict.openBetsCloseIn': 'ஓப்பன் பந்தயங்கள் மூடப்பட இன்னும்:',
  'predict.closeBetsCloseIn': 'க்ளோஸ் பந்தயங்கள் மூடப்பட இன்னும்:',
  'predict.closedForRound': 'இந்த ரவுண்டிற்கு மூடப்பட்டது',
  'predict.left': 'மீதம்',
  'predict.openGroup': 'ஓப்பன்',
  'predict.closeGroup': 'க்ளோஸ்',
  'predict.yourPick': 'உங்கள் எண்',
  'predict.stake': 'பந்தயத் தொகை',
  'predict.stakeHint': '{min} முதல் {max} வரை',
  'predict.spendable': 'செலவிடக்கூடியது: {n} டோக்கன்கள் (முதலில் முதன்மை, பின் வெற்றித் தொகை)',
  'predict.placed': 'வைக்கப்பட்டது — {number}, {mult}x இல். புதிய இருப்பு: {bal}.',
  'predict.placing': 'வைக்கப்படுகிறது…',
  'predict.timeUp': 'இந்த வகைக்கான நேரம் முடிந்துவிட்டது',
  'predict.placePrediction': 'ப்ரெடிக்ஷனை வைக்கவும்',
  'predict.statusOpen': 'ஓப்பன் · {t} இல் மூடும்',
  'predict.statusUpcoming': '{t} இல் திறக்கும்',
  'predict.statusClosedToday': 'இன்றைக்கு மூடப்பட்டது',
  'type.OPEN_SINGLE': 'சிங்கிள் (ஓப்பன்)',
  'type.CLOSE_SINGLE': 'சிங்கிள் (க்ளோஸ்)',
  'type.JODI': 'ஜோடி',
  'type.OPEN_SINGLE_PANA': 'சிங்கிள் பானா (ஓப்பன்)',
  'type.CLOSE_SINGLE_PANA': 'சிங்கிள் பானா (க்ளோஸ்)',
  'type.OPEN_DOUBLE_PANA': 'டபுள் பானா (ஓப்பன்)',
  'type.CLOSE_DOUBLE_PANA': 'டபுள் பானா (க்ளோஸ்)',
  'type.OPEN_TRIPLE_PANA': 'ட்ரிபுள் பானா (ஓப்பன்)',
  'type.CLOSE_TRIPLE_PANA': 'ட்ரிபுள் பானா (க்ளோஸ்)',
};

const kn: Dict = {
  'lang.title': 'ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
  'lang.subtitle': 'ಇದನ್ನು ನೀವು ಮೇಲಿನ ಮೆನುವಿನಿಂದ ಯಾವಾಗ ಬೇಕಾದರೂ ಬದಲಾಯಿಸಬಹುದು.',
  'lang.continue': 'ಮುಂದುವರಿಸಿ',
  'login.usernameLabel': 'ಬಳಕೆದಾರ ಹೆಸರು',
  'login.passwordLabel': 'ಪಾಸ್‌ವರ್ಡ್',
  'login.signIn': 'ಸೈನ್ ಇನ್ ಮಾಡಿ',
  'login.signingIn': 'ಸೈನ್ ಇನ್ ಆಗುತ್ತಿದೆ…',
  'login.noSelfSignup': 'ಖಾತೆಗಳನ್ನು ನಿರ್ವಾಹಕರು ಮಾತ್ರ ರಚಿಸುತ್ತಾರೆ — ಸ್ವಯಂ ನೋಂದಣಿಗೆ ಅವಕಾಶವಿಲ್ಲ.',
  'login.back': 'ಹಿಂದೆ',
  'header.signOut': 'ಸೈನ್ ಔಟ್',
  'header.purseTitle': 'ಖರ್ಚು ಮಾಡಬಹುದಾದ ಬ್ಯಾಲೆನ್ಸ್',
  'header.language': 'ಭಾಷೆ',
  'nav.predict': 'ಪ್ರಿಡಿಕ್ಟ್',
  'nav.overview': 'ಅವಲೋಕನ',
  'nav.yourRates': 'ನಿಮ್ಮ ದರಗಳು',
  'nav.myPredictions': 'ನನ್ನ ಪ್ರಿಡಿಕ್ಷನ್‌ಗಳು',
  'nav.requestTokens': 'ಟೋಕನ್‌ಗಳಿಗಾಗಿ ವಿನಂತಿಸಿ',
  'nav.tokenHistory': 'ಟೋಕನ್ ಇತಿಹಾಸ',
  'nav.yourSessions': 'ನಿಮ್ಮ ಸೆಷನ್‌ಗಳು',
  'nav.aboutTokens': 'ಟೋಕನ್‌ಗಳ ಬಗ್ಗೆ',
  'dash.welcome': 'ಸ್ವಾಗತ',
  'dash.subtitle': 'ನಿಮ್ಮ ಖಾತೆ, ಬ್ಯಾಲೆನ್ಸ್ ಮತ್ತು ಪ್ರಿಡಿಕ್ಷನ್ ಚಟುವಟಿಕೆಯನ್ನು ವೀಕ್ಷಿಸಿ.',
  'dash.mainBalance': 'ಮುಖ್ಯ ಬ್ಯಾಲೆನ್ಸ್',
  'dash.mainBalanceHint': 'ನೀವು ಪ್ರಿಡಿಕ್ಟ್ ಮಾಡಿದಾಗ ಮೊದಲು ಇದೇ ಖರ್ಚಾಗುತ್ತದೆ',
  'dash.winnings': 'ಗೆದ್ದ ಮೊತ್ತ',
  'dash.winningsHint': 'ಪಾವತಿಗಳು ಇಲ್ಲಿಗೆ ಬರುತ್ತವೆ — ಮುಖ್ಯ ಬ್ಯಾಲೆನ್ಸ್ ಖಾಲಿಯಾದ ನಂತರವೇ ಖರ್ಚು ಮಾಡಬಹುದು',
  'dash.account': 'ಖಾತೆ',
  'dash.active': 'ಸಕ್ರಿಯ',
  'dash.disabled': 'ನಿಷ್ಕ್ರಿಯ',
  'dash.yourAgent': 'ನಿಮ್ಮ ಏಜೆಂಟ್',
  'dash.yourAgentHint': 'ಸಹಾಯಕ್ಕಾಗಿ ಯಾರನ್ನು ಸಂಪರ್ಕಿಸಬೇಕು',
  'dash.aboutTokensTitle': 'ಟೋಕನ್‌ಗಳ ಬಗ್ಗೆ',
  'dash.aboutTokensBody':
    'ಟೋಕನ್‌ಗಳು ಒಂದು ಕ್ಲೋಸ್ಡ್-ಲೂಪ್ ಸಿಮ್ಯುಲೇಶನ್ ಕರೆನ್ಸಿ. ಇವುಗಳನ್ನು ಖರೀದಿಸಲು, ಮಾರಾಟ ಮಾಡಲು, ರಿಡೀಮ್ ಮಾಡಲು, ವರ್ಗಾಯಿಸಲು ಅಥವಾ ಮೌಲ್ಯಯುತವಾದ ಯಾವುದಕ್ಕೂ ಪರಿವರ್ತಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ, ಮತ್ತು ಯಾವುದೇ ರೀತಿಯ ಠೇವಣಿ ಅಥವಾ ಹಿಂಪಡೆಯುವಿಕೆ ಇರುವುದಿಲ್ಲ. ನಿಮ್ಮ ಬ್ಯಾಲೆನ್ಸ್‌ನಲ್ಲಿ ಆಗುವ ಪ್ರತಿ ಬದಲಾವಣೆಯನ್ನು ಆಡಿಟ್ ಮಾಡಬಹುದಾದ ಲೆಡ್ಜರ್‌ನಲ್ಲಿ ದಾಖಲಿಸಲಾಗುತ್ತದೆ.',
  'dash.tokenHistoryDesc': 'ನಿಮ್ಮ ಬ್ಯಾಲೆನ್ಸ್‌ನಲ್ಲಿ ಆಗುವ ಪ್ರತಿ ಬದಲಾವಣೆ.',
  'predict.loading': 'ಆಟಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ…',
  'predict.day': 'ಹಗಲು',
  'predict.night': 'ರಾತ್ರಿ',
  'predict.backAllGames': 'ಎಲ್ಲಾ ಆಟಗಳು',
  'predict.noGames': 'ಈಗ ಯಾವುದೇ ಆಟ ತೆರೆದಿಲ್ಲ — ನಿಮ್ಮ ಏಜೆಂಟ್‌ನ ನಿರ್ವಾಹಕರು ಒಂದು ಆಟವನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿದ ನಂತರ ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ.',
  'predict.notInList': 'ಈ ಆಟ ಇಂದಿನ ಪಟ್ಟಿಯಲ್ಲಿ ಇಲ್ಲ — ಇದನ್ನು ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಿರಬಹುದು, ಅಥವಾ ಲಿಂಕ್ ಹಳೆಯದಾಗಿರಬಹುದು.',
  'predict.backToGames': 'ಆಟಗಳಿಗೆ ಹಿಂತಿರುಗಿ',
  'predict.closedForToday': '{name} ಇಂದಿಗೆ ಮುಚ್ಚಲಾಗಿದೆ — ನಾಳೆ ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ.',
  'predict.opensAtInfo':
    '{name} ನ ಓಪನ್ ಘೋಷಣೆ {time} ಗಂಟೆಗೆ ಆಗುತ್ತದೆ — ಓಪನ್/ಜೋಡಿ/ಸಂಗಮ ಬೆಟ್‌ಗಳು ಅದಕ್ಕೆ ಒಂದು ನಿಮಿಷ ಮೊದಲೇ ಮುಚ್ಚುತ್ತವೆ; ಕ್ಲೋಸ್ ಬೆಟ್‌ಗಳು ಪ್ರತ್ಯೇಕವಾಗಿ ತೆರೆದಿರುತ್ತವೆ.',
  'predict.openBetsCloseIn': 'ಓಪನ್ ಬೆಟ್‌ಗಳು ಮುಚ್ಚಲು:',
  'predict.closeBetsCloseIn': 'ಕ್ಲೋಸ್ ಬೆಟ್‌ಗಳು ಮುಚ್ಚಲು:',
  'predict.closedForRound': 'ಈ ರೌಂಡ್‌ಗೆ ಮುಚ್ಚಲಾಗಿದೆ',
  'predict.left': 'ಬಾಕಿ ಇದೆ',
  'predict.openGroup': 'ಓಪನ್',
  'predict.closeGroup': 'ಕ್ಲೋಸ್',
  'predict.yourPick': 'ನಿಮ್ಮ ಸಂಖ್ಯೆ',
  'predict.stake': 'ಸ್ಟೇಕ್',
  'predict.stakeHint': '{min} ಮತ್ತು {max} ನಡುವೆ',
  'predict.spendable': 'ಖರ್ಚು ಮಾಡಬಹುದಾದದ್ದು: {n} ಟೋಕನ್‌ಗಳು (ಮೊದಲು ಮುಖ್ಯ, ನಂತರ ಗೆದ್ದ ಮೊತ್ತ)',
  'predict.placed': 'ಇಡಲಾಗಿದೆ — {number}, {mult}x ನಲ್ಲಿ. ಹೊಸ ಬ್ಯಾಲೆನ್ಸ್: {bal}.',
  'predict.placing': 'ಇಡಲಾಗುತ್ತಿದೆ…',
  'predict.timeUp': 'ಈ ಪ್ರಕಾರಕ್ಕೆ ಸಮಯ ಮುಗಿದಿದೆ',
  'predict.placePrediction': 'ಪ್ರಿಡಿಕ್ಷನ್ ಇಡಿ',
  'predict.statusOpen': 'ಓಪನ್ · {t} ನಲ್ಲಿ ಮುಚ್ಚುತ್ತದೆ',
  'predict.statusUpcoming': '{t} ನಲ್ಲಿ ತೆರೆಯುತ್ತದೆ',
  'predict.statusClosedToday': 'ಇಂದಿಗೆ ಮುಚ್ಚಲಾಗಿದೆ',
  'type.OPEN_SINGLE': 'ಸಿಂಗಲ್ (ಓಪನ್)',
  'type.CLOSE_SINGLE': 'ಸಿಂಗಲ್ (ಕ್ಲೋಸ್)',
  'type.JODI': 'ಜೋಡಿ',
  'type.OPEN_SINGLE_PANA': 'ಸಿಂಗಲ್ ಪಾನಾ (ಓಪನ್)',
  'type.CLOSE_SINGLE_PANA': 'ಸಿಂಗಲ್ ಪಾನಾ (ಕ್ಲೋಸ್)',
  'type.OPEN_DOUBLE_PANA': 'ಡಬಲ್ ಪಾನಾ (ಓಪನ್)',
  'type.CLOSE_DOUBLE_PANA': 'ಡಬಲ್ ಪಾನಾ (ಕ್ಲೋಸ್)',
  'type.OPEN_TRIPLE_PANA': 'ಟ್ರಿಪಲ್ ಪಾನಾ (ಓಪನ್)',
  'type.CLOSE_TRIPLE_PANA': 'ಟ್ರಿಪಲ್ ಪಾನಾ (ಕ್ಲೋಸ್)',
};

const DICTS: Record<Lang, Dict> = { en, hi, te, ta, kn, mr };

const STORAGE_KEY = 'predictsim_lang';

function isLang(v: string | null): v is Lang {
  return v !== null && v in DICTS;
}

/** Whether a language has ever been explicitly chosen on this device — lets
 *  the pre-login picker default to a saved choice instead of always
 *  starting from English. */
export function savedLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

interface LangValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Looks up `key` in the active language, falling back to `fallback` (or
   *  the English copy, or the key itself) if it's missing there. `params`
   *  fills in `{placeholder}` tokens — every translation keeps the same
   *  token names as the English source. */
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
}

const noop = () => {};
const LangContext = createContext<LangValue>({
  lang: 'en',
  setLang: noop,
  t: (key, fallback) => fallback ?? key,
});

export function useLang(): LangValue {
  return useContext(LangContext);
}

/** Wrap the Player app (only) in this — every other portal has no provider
 *  in its tree, so `useLang()` there just returns the English passthrough
 *  above and behaves exactly as it did before this existed. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => savedLang() ?? 'en');

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Private browsing / storage disabled — the choice just won't
      // survive a reload, which is a reasonable degradation, not an error.
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string, params?: Record<string, string | number>) => {
      let str = DICTS[lang][key] ?? fallback ?? DICTS.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.split(`{${k}}`).join(String(v));
        }
      }
      return str;
    },
    [lang],
  );

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}
