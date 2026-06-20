import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { WalletLinkDto } from './dto/wallet-link.dto';
import { WalletNonceDto } from './dto/wallet-nonce.dto';
import { WalletsService } from './wallets.service';

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post('nonce')
  async nonce(@CurrentUser() user: AuthUser, @Body() dto: WalletNonceDto) {
    return { data: await this.walletsService.createNonce(user.id, dto) };
  }

  @Post('link')
  async link(@CurrentUser() user: AuthUser, @Body() dto: WalletLinkDto) {
    return { data: await this.walletsService.linkWallet(user.id, dto) };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return { data: await this.walletsService.listMine(user.id) };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') walletId: string) {
    return { data: await this.walletsService.remove(user.id, walletId) };
  }
}
