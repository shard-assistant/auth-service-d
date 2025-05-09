import {
	BadRequestException,
	Injectable,
	NotFoundException
} from "@nestjs/common"
import { TokenType } from "@prisma/__generated__"
import { hash } from "argon2"
import { v4 as uuidv4 } from "uuid"

import { PrismaService } from "@/prisma/prisma.service"
import { UserService } from "@/user/user.service"

import { NotificationService } from '@/libs/notification/notification.service'
import { ConfigService } from '@nestjs/config'
import { NewPasswordDto } from "./dto/new-password.dto"
import { ResetPasswordDto } from "./dto/reset-password.dto"

@Injectable()
export class PasswordRecoveryService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly userService: UserService,
		private readonly configService: ConfigService,
		private readonly notificationService: NotificationService
	) {}

	public async resetPassword(dto: ResetPasswordDto) {
		const existingUser = await this.userService.findByEmail(dto.email)

		if (!existingUser) {
			throw new NotFoundException(
				"Пользователь не найден. Проверьте введенный адрес электронной почты"
			)
		}

		const passwordResetToken = await this.generatePasswordResetToken(
			existingUser.email
		)

		const domain = this.configService.getOrThrow<string>("ALLOWED_ORIGIN")
		const resetLink = `${domain}/auth/new-password?token=${passwordResetToken.token}`

		await this.notificationService
			.sendNotification("mail", passwordResetToken.email, 'reset_password', { 
				resetLink
			}
		)

		return true
	}

	public async newPassword(dto: NewPasswordDto, token: string) {
		const existingToken = await this.prisma.token.findFirst({
			where: {
				token,
				type: TokenType.PASSWORD_RESET
			}
		})

		if (!existingToken) {
			throw new NotFoundException(
				"Ссылка для сброса пароля недействительна. Пожалуйста, запросите новый сброс пароля"
			)
		}

		const hasExpired = new Date(existingToken.expiresIn) < new Date()

		if (hasExpired) {
			throw new BadRequestException(
				"Ссылка для сброса пароля истекла. Пожалуйста, запросите новый сброс пароля"
			)
		}

		const existingUser = await this.userService.findByEmail(existingToken.email)

		if (!existingUser) {
			throw new NotFoundException(
				"Пользователь не найден. Проверьте введенный адрес электронной почты"
			)
		}

		await this.prisma.user.update({
			where: { id: existingUser.id },
			data: {
				password: await hash(dto.password)
			}
		})

		await this.prisma.token.delete({
			where: {
				id: existingToken.id,
				type: TokenType.PASSWORD_RESET
			}
		})

		return true
	}

	private async generatePasswordResetToken(email: string) {
		const token = uuidv4()
		const expiresIn = new Date(new Date().getTime() + 3600 * 1000)

		const existingToken = await this.prisma.token.findFirst({
			where: {
				email,
				type: TokenType.PASSWORD_RESET
			}
		})

		if (existingToken) {
			await this.prisma.token.delete({
				where: {
					id: existingToken.id,
					type: TokenType.PASSWORD_RESET
				}
			})
		}

		const passwordResetToken = await this.prisma.token.create({
			data: {
				email,
				token,
				expiresIn,
				type: TokenType.PASSWORD_RESET
			}
		})

		return passwordResetToken
	}
}
