import { Module, forwardRef } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { GoogleRecaptchaModule } from "@nestlab/google-recaptcha"

import { getProvidersConfig } from "@/config/providers.config"
import { getRecaptchaConfig } from "@/config/recaptcha.config"
import { UserService } from "@/user/user.service"

import { NotificationModule } from '@/libs/notification/notification.module'
import { AuthController } from "./auth.controller"
import { AuthService } from "./auth.service"
import { EmailConfirmationModule } from "./email-confirmation/email-confirmation.module"
import { ProviderModule } from "./provider/provider.module"
import { TwoFactorAuthService } from "./two-factor-auth/two-factor-auth.service"

@Module({
	imports: [
		ProviderModule.registerAsync({
			imports: [ConfigModule],
			useFactory: getProvidersConfig,
			inject: [ConfigService]
		}),
		GoogleRecaptchaModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: getRecaptchaConfig,
			inject: [ConfigService]
		}),
		forwardRef(() => EmailConfirmationModule),
		NotificationModule
	],
	controllers: [AuthController],
	providers: [AuthService, UserService, TwoFactorAuthService],
	exports: [AuthService]
})
export class AuthModule {}
