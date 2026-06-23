import { Module } from '@nestjs/common';
import { UserProofsModule } from '../user-proofs/user-proofs.module';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [UserProofsModule],
  controllers: [WalletsController],
  providers: [WalletsService],
})
export class WalletsModule {}
