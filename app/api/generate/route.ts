import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { 
    IGenerateRequest, 
    IGenerateResponse, 
    IStyleOptions, 
    IGenerateOptions, 
    ART_STYLES, 
    COLOR_TONES, 
    LOGO_STYLES, 
    LOGO_COLOR_TONES, 
    DEFAULT_GENERATE_OPTIONS, 
    ArtStyle, 
    ColorTone, 
    LogoStyle, 
    LogoColorTone 
} from '@/types';
import { createRateLimiter, sanitizeInput, containsInappropriateContent } from '@/lib/utils';

// 환경변수 검증 및 로깅
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
console.log('🔍 Environment check:', {
    hasToken: !!REPLICATE_API_TOKEN,
    tokenLength: REPLICATE_API_TOKEN?.length || 0,
    nodeEnv: process.env.NODE_ENV
});

if (!REPLICATE_API_TOKEN) {
    console.error('❌ REPLICATE_API_TOKEN이 설정되지 않았습니다.');
    throw new Error('REPLICATE_API_TOKEN 환경변수가 설정되지 않았습니다.');
}

// 레이트 리미터 생성 (IP당 분당 3회 제한)
const rateLimiter = createRateLimiter(3, 60 * 1000);

// Replicate 클라이언트 초기화
const replicate = new Replicate({
    auth: REPLICATE_API_TOKEN,
});

// 입력 검증 함수
function validateInput(prompt: string, styleOptions: unknown, generateOptions?: unknown): { isValid: boolean; message?: string } {
    if (!prompt || typeof prompt !== 'string') {
        return { isValid: false, message: '프롬프트가 누락되었습니다.' };
    }
    
    const sanitized = sanitizeInput(prompt);
    const trimmed = sanitized.trim();
    
    if (trimmed.length < 1) {
        return { isValid: false, message: '프롬프트를 입력해주세요.' };
    }
    
    if (trimmed.length > 500) {
        return { isValid: false, message: '프롬프트는 1-500자 사이여야 합니다.' };
    }

    if (containsInappropriateContent(trimmed)) {
        return { isValid: false, message: '부적절한 내용이 포함되어 있습니다.' };
    }

    if (!styleOptions || typeof styleOptions !== 'object') {
        return { isValid: false, message: '스타일 옵션이 누락되었습니다.' };
    }

    const options = styleOptions as IStyleOptions;
    
    // 생성 모드 검증
    if (options.generationMode !== 'general' && options.generationMode !== 'logo') {
        return { isValid: false, message: '유효하지 않은 생성 모드입니다.' };
    }

    if (options.generationMode === 'logo') {
        // 로고 생성 모드 검증
        if (!options.logoStyle || !LOGO_STYLES.includes(options.logoStyle as LogoStyle)) {
            return { isValid: false, message: '유효하지 않은 로고 스타일입니다.' };
        }

        if (!options.logoColorTone || !LOGO_COLOR_TONES.includes(options.logoColorTone as LogoColorTone)) {
            return { isValid: false, message: '유효하지 않은 로고 색조입니다.' };
        }
    } else {
        // 일반 이미지 생성 모드 검증
        if (!ART_STYLES.includes(options.artStyle as ArtStyle)) {
            return { isValid: false, message: '유효하지 않은 아트 스타일입니다.' };
        }

        if (!COLOR_TONES.includes(options.colorTone as ColorTone)) {
            return { isValid: false, message: '유효하지 않은 색조 옵션입니다.' };
        }
    }

    // 생성 옵션 검증
    if (generateOptions && typeof generateOptions === 'object') {
        const genOptions = generateOptions as Record<string, unknown>;
        
        if (genOptions.seed !== undefined && (typeof genOptions.seed !== 'number' || genOptions.seed < 0)) {
            return { isValid: false, message: '시드 값은 0 이상의 정수여야 합니다.' };
        }
        
        if (genOptions.num_outputs !== undefined && (typeof genOptions.num_outputs !== 'number' || genOptions.num_outputs < 1 || genOptions.num_outputs > 4)) {
            return { isValid: false, message: '출력 수는 1-4 사이여야 합니다.' };
        }
        
        if (genOptions.output_quality !== undefined && (typeof genOptions.output_quality !== 'number' || genOptions.output_quality < 0 || genOptions.output_quality > 100)) {
            return { isValid: false, message: '품질은 0-100 사이여야 합니다.' };
        }
        
        if (genOptions.num_inference_steps !== undefined && (typeof genOptions.num_inference_steps !== 'number' || genOptions.num_inference_steps < 1 || genOptions.num_inference_steps > 4)) {
            return { isValid: false, message: '추론 단계는 1-4 사이여야 합니다.' };
        }
    }

    return { isValid: true };
}

// 스타일 매핑 함수
function getStylePrompt(styleOptions: IStyleOptions): string {
    if (styleOptions.generationMode === 'logo') {
        // 로고 생성 모드
        const logoStyleMapping = {
            logoStyle: {
                '미니멀': 'minimalist logo, clean design, simple, professional',
                '모던': 'modern logo, contemporary design, sleek, trendy',
                '클래식': 'classic logo, traditional design, timeless, elegant',
                '빈티지': 'vintage logo, retro design, nostalgic, aged aesthetic',
                '기업형': 'corporate logo, business professional, formal, trustworthy',
                '창조적': 'creative logo, artistic design, unique, innovative',
                '대담한': 'bold logo, strong design, impactful, striking',
                '우아한': 'elegant logo, refined design, sophisticated, graceful'
            },
            logoColorTone: {
                '단색': 'monochrome, single color, solid color scheme',
                '그라데이션': 'gradient colors, smooth color transitions, dimensional',
                '네온': 'neon colors, bright fluorescent, glowing effect',
                '메탈릭': 'metallic colors, shiny finish, premium look',
                '투명배경': 'transparent background, isolated design, clean cutout'
            }
        };

        const logoStyleDesc = logoStyleMapping.logoStyle[styleOptions.logoStyle || '미니멀'];
        const logoColorToneDesc = logoStyleMapping.logoColorTone[styleOptions.logoColorTone || '단색'];

        return `${logoStyleDesc}, ${logoColorToneDesc}, vector style, scalable design`;
    } else {
        // 일반 이미지 생성 모드
        const styleMapping = {
            artStyle: {
                '디지털아트': 'digital art, highly detailed, professional quality',
                '수채화': 'watercolor painting, soft brushstrokes, artistic',
                '유화': 'oil painting, textured brushstrokes, canvas',
                '펜화': 'pen and ink drawing, line art, detailed linework',
                '연필화': 'pencil sketch, detailed shading, graphite drawing'
            },
            colorTone: {
                '밝은': 'bright colors, vibrant, high key lighting',
                '어두운': 'dark tones, moody, low key lighting',
                '파스텔': 'pastel colors, soft tones, gentle hues',
                '흑백': 'black and white, monochrome, grayscale',
                '컬러풀': 'colorful, saturated colors, rainbow palette'
            }
        };

        const artStyleDesc = styleMapping.artStyle[styleOptions.artStyle] || styleOptions.artStyle;
        const colorToneDesc = styleMapping.colorTone[styleOptions.colorTone] || styleOptions.colorTone;

        return `${artStyleDesc}, ${colorToneDesc}`;
    }
}

// IP 주소 가져오기 함수
function getClientIP(request: Request): string {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    
    if (realIP) {
        return realIP;
    }
    
    return '127.0.0.1'; // 기본값
}

export async function POST(request: Request) {
    try {
        // 레이트 리미팅 체크
        const clientIP = getClientIP(request);
        if (!rateLimiter(clientIP)) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
                },
            } as IGenerateResponse, { status: 429 });
        }

        // 요청 데이터 파싱
        let requestData: IGenerateRequest;
        try {
            requestData = await request.json();
        } catch (error) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'INVALID_JSON',
                    message: '요청 데이터가 유효하지 않습니다.',
                },
            } as IGenerateResponse, { status: 400 });
        }

        const { prompt, styleOptions, generateOptions } = requestData;

        // 입력값 검증
        const validation = validateInput(prompt, styleOptions, generateOptions);
        if (!validation.isValid) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: validation.message || '입력값이 유효하지 않습니다.',
                },
            } as IGenerateResponse, { status: 400 });
        }

        // 스타일 옵션을 프롬프트에 적용
        const stylePrompt = getStylePrompt(styleOptions);
        const sanitizedPrompt = sanitizeInput(prompt).trim();
        const enhancedPrompt = `${sanitizedPrompt}, ${stylePrompt}, high quality, masterpiece`;

        // 생성 옵션 병합
        const finalGenerateOptions = {
            ...DEFAULT_GENERATE_OPTIONS,
            ...generateOptions
        };

        // Replicate API 호출
        console.log('🚀 Replicate API 호출 시작:', {
            model: "black-forest-labs/flux-schnell",
            enhancedPrompt,
            generateOptions: finalGenerateOptions,
            timestamp: new Date().toISOString()
        });

        const prediction = await replicate.predictions.create({
            model: "black-forest-labs/flux-schnell",
            input: {
                prompt: enhancedPrompt,
                aspect_ratio: finalGenerateOptions.aspect_ratio,
                num_outputs: finalGenerateOptions.num_outputs,
                go_fast: finalGenerateOptions.go_fast,
                megapixels: finalGenerateOptions.megapixels,
                output_format: finalGenerateOptions.output_format,
                output_quality: finalGenerateOptions.output_quality,
                num_inference_steps: finalGenerateOptions.num_inference_steps,
                disable_safety_checker: finalGenerateOptions.disable_safety_checker,
                seed: finalGenerateOptions.seed,
                negative_prompt: "blurry, low quality, distorted, deformed, nsfw, inappropriate content, violence, hate, discrimination"
            }
        });

        console.log('🔄 Prediction 생성됨:', {
            id: prediction.id,
            status: prediction.status,
            timestamp: new Date().toISOString()
        });

        // 예측 결과 확인을 위한 폴링
        let finalPrediction = prediction;
        let retryCount = 0;
        const maxRetries = 60; // 최대 60초 대기

        console.log('⏳ 폴링 시작:', {
            initialStatus: finalPrediction.status,
            maxRetries,
            timestamp: new Date().toISOString()
        });

        while (
            finalPrediction.status !== "succeeded" && 
            finalPrediction.status !== "failed" &&
            finalPrediction.status !== "canceled" &&
            retryCount < maxRetries
        ) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            finalPrediction = await replicate.predictions.get(prediction.id);
            retryCount++;
            
            if (retryCount % 10 === 0) { // 10초마다 로깅
                console.log(`🔄 폴링 진행 중: ${retryCount}/${maxRetries}, 상태: ${finalPrediction.status}`);
            }
        }

        console.log('🏁 폴링 완료:', {
            finalStatus: finalPrediction.status,
            retryCount,
            hasOutput: !!finalPrediction.output,
            timestamp: new Date().toISOString()
        });

        // 생성 실패 처리
        if (finalPrediction.status === "failed") {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'GENERATION_FAILED',
                    message: '이미지 생성에 실패했습니다.',
                },
            } as IGenerateResponse, { status: 500 });
        }

        // 타임아웃 처리
        if (retryCount >= maxRetries) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'TIMEOUT',
                    message: '이미지 생성 시간이 초과되었습니다.',
                },
            } as IGenerateResponse, { status: 408 });
        }

        // 취소 처리
        if (finalPrediction.status === "canceled") {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'CANCELLED',
                    message: '이미지 생성이 취소되었습니다.',
                },
            } as IGenerateResponse, { status: 409 });
        }

        // 출력 결과 검증
        if (!finalPrediction.output || !Array.isArray(finalPrediction.output) || finalPrediction.output.length === 0) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'NO_OUTPUT',
                    message: '생성된 이미지가 없습니다.',
                },
            } as IGenerateResponse, { status: 500 });
        }

        // 성공 응답
        console.log('✅ 이미지 생성 성공:', {
            imageUrl: finalPrediction.output[0],
            totalTime: `${retryCount}초`,
            timestamp: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            imageUrl: finalPrediction.output[0],
        } as IGenerateResponse);

    } catch (error) {
        console.error('❌ 이미지 생성 에러:', {
            error: error instanceof Error ? error.message : '알 수 없는 에러',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
        
        // Replicate API 에러 처리
        if (error instanceof Error && error.message.includes('rate limit')) {
            console.log('🚫 Rate limit 에러 발생');
            return NextResponse.json({
                success: false,
                error: {
                    code: 'RATE_LIMIT',
                    message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
                },
            } as IGenerateResponse, { status: 429 });
        }

        // 네트워크 에러 처리
        if (error instanceof Error && error.message.includes('network')) {
            console.log('🌐 네트워크 에러 발생');
            return NextResponse.json({
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: '네트워크 오류가 발생했습니다. 연결을 확인해주세요.',
                },
            } as IGenerateResponse, { status: 503 });
        }

        // 기타 서버 오류
        console.log('🔴 서버 에러 발생');
        return NextResponse.json({
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: '서버 오류가 발생했습니다.',
            },
        } as IGenerateResponse, { status: 500 });
    }
} 